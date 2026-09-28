# Python Auto Mail Sender Bot

Sends personalised emails to everyone in `recipients.csv`. Standard library only (Python 3.10+).

## Setup
1. `cp .env.example .env` and fill in your email + password
   (Gmail: turn on 2-Step Verification, then create an **App Password** at
   https://myaccount.google.com/apppasswords and use that).
   Or edit the `CONFIG` section at the top of `auto_mail_sender.py` directly.
2. Put your data in `recipients.csv` — `email` column is required; every other
   column (e.g. `name`, `company`) can be used as `{column}` in the subject and templates.
   Optional columns: `subject` (per-person subject), `attachment` (`;`-separated file paths).
3. Edit `template.txt` / `template.html` (delete `template.html` for plain text only).

## Run
```bash
python auto_mail_sender.py --dry-run     # preview, nothing is sent
python auto_mail_sender.py               # send now
python auto_mail_sender.py --every 60    # send every 60 minutes
python auto_mail_sender.py --at 09:30    # send every day at 09:30
```
Results are logged to `sent_log.csv`.
