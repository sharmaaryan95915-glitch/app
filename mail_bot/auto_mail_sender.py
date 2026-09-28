#!/usr/bin/env python3
"""
Auto Mail Sender Bot
====================

Sends personalised emails to every person listed in a CSV file.

How to use:
  1. Fill in your email settings in the CONFIG section below
     (or put them in a `.env` file next to this script - see `.env.example`).
  2. Put your recipients in `recipients.csv` (name, email, and any extra columns).
  3. Edit `template.txt` (plain text) and/or `template.html` (HTML).
     Use {column_name} placeholders, e.g. "Hello {name}".
  4. Run:
        python auto_mail_sender.py              # send once to everyone
        python auto_mail_sender.py --dry-run    # preview without sending
        python auto_mail_sender.py --every 60   # repeat every 60 minutes
        python auto_mail_sender.py --at 09:30   # send every day at 09:30

Uses only the Python standard library - no pip install needed.
"""

import argparse
import csv
import mimetypes
import os
import smtplib
import ssl
import sys
import time
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# .env loader (so you don't have to hard-code your password)
# ---------------------------------------------------------------------------
def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(BASE_DIR / ".env")


# ---------------------------------------------------------------------------
# CONFIG - put your data here (values in .env / environment override these)
# ---------------------------------------------------------------------------
CONFIG = {
    # Gmail: smtp.gmail.com / 587. Outlook: smtp.office365.com / 587.
    # Yahoo: smtp.mail.yahoo.com / 587.
    "SMTP_SERVER": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "SMTP_PORT": int(os.getenv("SMTP_PORT", "587")),
    "SENDER_EMAIL": os.getenv("SENDER_EMAIL", "your_email@gmail.com"),
    # For Gmail use an "App Password", NOT your normal password:
    # https://myaccount.google.com/apppasswords
    "SENDER_PASSWORD": os.getenv("SENDER_PASSWORD", "your_app_password"),
    "SENDER_NAME": os.getenv("SENDER_NAME", "Auto Mail Bot"),
    "SUBJECT": os.getenv("SUBJECT", "Hello {name}!"),
    "RECIPIENTS_FILE": os.getenv("RECIPIENTS_FILE", str(BASE_DIR / "recipients.csv")),
    "TEXT_TEMPLATE": os.getenv("TEXT_TEMPLATE", str(BASE_DIR / "template.txt")),
    "HTML_TEMPLATE": os.getenv("HTML_TEMPLATE", str(BASE_DIR / "template.html")),
    # Comma-separated file paths attached to every email (optional)
    "ATTACHMENTS": os.getenv("ATTACHMENTS", ""),
    # Seconds to wait between emails (avoids being flagged as spam)
    "DELAY_SECONDS": float(os.getenv("DELAY_SECONDS", "2")),
    "LOG_FILE": os.getenv("LOG_FILE", str(BASE_DIR / "sent_log.csv")),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
class SafeDict(dict):
    """Leaves unknown {placeholders} untouched instead of crashing."""

    def __missing__(self, key):
        return "{" + key + "}"


def render(template: str, data: dict) -> str:
    return template.format_map(SafeDict(data))


def read_recipients(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = []
        for row in csv.DictReader(f):
            row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
            if row.get("email"):
                rows.append(row)
    return rows


def read_optional(path: str) -> str | None:
    p = Path(path)
    return p.read_text(encoding="utf-8") if p.exists() else None


def attach_files(msg: EmailMessage, paths: list[str]) -> None:
    for raw in paths:
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = BASE_DIR / path
        if not path.exists():
            print(f"  ! attachment not found, skipped: {path}")
            continue
        ctype, _ = mimetypes.guess_type(path.name)
        maintype, subtype = (ctype or "application/octet-stream").split("/", 1)
        msg.add_attachment(path.read_bytes(), maintype=maintype,
                           subtype=subtype, filename=path.name)


def build_message(person: dict, text_tpl: str | None, html_tpl: str | None) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = f'{CONFIG["SENDER_NAME"]} <{CONFIG["SENDER_EMAIL"]}>'
    msg["To"] = person["email"]
    msg["Subject"] = render(person.get("subject") or CONFIG["SUBJECT"], person)

    text_body = render(text_tpl, person) if text_tpl else "Hello {name}".format_map(SafeDict(person))
    msg.set_content(text_body)
    if html_tpl:
        msg.add_alternative(render(html_tpl, person), subtype="html")

    attachments = [a.strip() for a in CONFIG["ATTACHMENTS"].split(",") if a.strip()]
    # A per-person "attachment" column in the CSV is also supported
    if person.get("attachment"):
        attachments += [a.strip() for a in person["attachment"].split(";") if a.strip()]
    attach_files(msg, attachments)
    return msg


def log_result(email: str, status: str, error: str = "") -> None:
    log_path = Path(CONFIG["LOG_FILE"])
    new_file = not log_path.exists()
    with open(log_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if new_file:
            writer.writerow(["time", "email", "status", "error"])
        writer.writerow([datetime.now().isoformat(timespec="seconds"), email, status, error])


# ---------------------------------------------------------------------------
# Main sending logic
# ---------------------------------------------------------------------------
def send_all(dry_run: bool = False) -> None:
    recipients = read_recipients(CONFIG["RECIPIENTS_FILE"])
    text_tpl = read_optional(CONFIG["TEXT_TEMPLATE"])
    html_tpl = read_optional(CONFIG["HTML_TEMPLATE"])

    if not recipients:
        print("No recipients found in", CONFIG["RECIPIENTS_FILE"])
        return

    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Sending to {len(recipients)} recipient(s)...")

    if dry_run:
        for person in recipients:
            msg = build_message(person, text_tpl, html_tpl)
            print("-" * 60)
            print("To:     ", msg["To"])
            print("Subject:", msg["Subject"])
            print(msg.get_body(preferencelist=("plain",)).get_content().strip())
        print("-" * 60)
        print("Dry run finished - nothing was sent.")
        return

    sent = failed = 0
    context = ssl.create_default_context()
    port = CONFIG["SMTP_PORT"]
    if port == 465:
        server = smtplib.SMTP_SSL(CONFIG["SMTP_SERVER"], port, context=context, timeout=30)
    else:
        server = smtplib.SMTP(CONFIG["SMTP_SERVER"], port, timeout=30)
        server.starttls(context=context)

    with server:
        server.login(CONFIG["SENDER_EMAIL"], CONFIG["SENDER_PASSWORD"])
        for i, person in enumerate(recipients, 1):
            try:
                server.send_message(build_message(person, text_tpl, html_tpl))
                sent += 1
                log_result(person["email"], "sent")
                print(f"  [{i}/{len(recipients)}] sent   -> {person['email']}")
            except Exception as exc:  # keep going if one address fails
                failed += 1
                log_result(person["email"], "failed", str(exc))
                print(f"  [{i}/{len(recipients)}] FAILED -> {person['email']}: {exc}")
            if i < len(recipients):
                time.sleep(CONFIG["DELAY_SECONDS"])

    print(f"Done. Sent: {sent}, Failed: {failed}. Log: {CONFIG['LOG_FILE']}")


def seconds_until(hhmm: str) -> float:
    hour, minute = map(int, hhmm.split(":"))
    now = datetime.now()
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


def main() -> None:
    parser = argparse.ArgumentParser(description="Auto Mail Sender Bot")
    parser.add_argument("--dry-run", action="store_true", help="preview emails without sending")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--every", type=float, metavar="MINUTES", help="repeat every N minutes")
    group.add_argument("--at", metavar="HH:MM", help="send every day at this time (24h)")
    args = parser.parse_args()

    if not args.dry_run and CONFIG["SENDER_PASSWORD"] in ("", "your_app_password"):
        sys.exit("Please set SENDER_EMAIL and SENDER_PASSWORD in the CONFIG section or .env file.")

    try:
        if args.every:
            while True:
                send_all(args.dry_run)
                print(f"Next run in {args.every} minute(s). Press Ctrl+C to stop.")
                time.sleep(args.every * 60)
        elif args.at:
            while True:
                wait = seconds_until(args.at)
                print(f"Waiting until {args.at} ({wait / 60:.1f} min). Press Ctrl+C to stop.")
                time.sleep(wait)
                send_all(args.dry_run)
        else:
            send_all(args.dry_run)
    except smtplib.SMTPAuthenticationError:
        sys.exit("Login failed. Check your email/password (Gmail needs an App Password).")
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
