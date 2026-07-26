from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import base64
import logging
import random
import secrets
import string
import uuid
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_PASSWORD = os.environ['ADMIN_PASSWORD']
EMERGENT_AUTH_BASE = os.environ['EMERGENT_AUTH_BASE']

SIGNUP_BONUS = 70
REFERRAL_REWARD = 300
DAILY_RATE = 0.04
SESSION_DAYS = 30
TELEGRAM_LINK = "https://t.me/+Kwsy2cWqzQRmYmY9"
SUPPORT_TELEGRAM = "https://t.me/+fPoKJBDQY-9lMTZl"
BIG_PAYMENT_UPI = "9905066606@ptyes"
BENEFICIARY_NAME = "Victory Pay"
USDT_ADDRESS = "TXk8rQSAztBGkFqmT8 dummy".replace(" ", "")
USDT_FALLBACK_RATE = 91.5
LEVEL_RATES = {1: 0.020, 2: 0.022, 3: 0.024, 4: 0.026, 5: 0.028, 6: 0.030, 7: 0.035}
LEVEL_BONUS = 10.0

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------- Helpers ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def gen_referral_code() -> str:
    return "VP" + secrets.token_hex(3).upper()


def gen_task_code() -> str:
    return "VP-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "user"),
        "balance": round(u.get("balance", 0), 2),
        "total_earned": round(u.get("total_earned", 0), 2),
        "referral_code": u.get("referral_code"),
        "referred_by": u.get("referred_by"),
        "picture": u.get("picture"),
        "auth_provider": u.get("auth_provider", "email"),
        "created_at": u.get("created_at"),
    }


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=SESSION_DAYS)),
    })
    return token


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session["expires_at"]
    exp_dt = datetime.fromisoformat(exp) if isinstance(exp, str) else exp
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
    if exp_dt < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def add_transaction(user_id: str, tx_type: str, amount: float, title: str):
    await db.transactions.insert_one({
        "tx_id": new_id("tx"),
        "user_id": user_id,
        "type": tx_type,
        "amount": round(amount, 2),
        "title": title,
        "created_at": iso(now_utc()),
    })


# ---------------- Models ----------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    referral_code: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionInput(BaseModel):
    session_token: str


class TaskPayInput(BaseModel):
    task_id: str
    screenshot: str  # base64 data url
    utr: str
    remarks: Optional[str] = None
    currency: Optional[str] = "INR"  # INR | USDT
    usdt_amount: Optional[float] = None
    method: Optional[str] = None


class WithdrawInput(BaseModel):
    amount: float
    account_id: str


class AccountInput(BaseModel):
    method: str
    holder_name: str
    upi_id: str


class RequestActionInput(BaseModel):
    note: Optional[str] = None


class SupportSendInput(BaseModel):
    text: str


class UpiConfigInput(BaseModel):
    upi_id: Optional[str] = None
    upi_name: Optional[str] = None


# ---------------- Auth ----------------
@api_router.post("/auth/register")
async def register(data: RegisterInput):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = new_id("user")
    referrer = None
    if data.referral_code:
        referrer = await db.users.find_one({"referral_code": data.referral_code.strip().upper()})
    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": data.name.strip(),
        "password_hash": hash_password(data.password), "auth_provider": "email", "role": "user",
        "balance": float(SIGNUP_BONUS), "total_earned": float(SIGNUP_BONUS),
        "referral_code": gen_referral_code(), "referred_by": referrer["user_id"] if referrer else None,
        "picture": None, "created_at": iso(now_utc()),
    })
    await add_transaction(user_id, "bonus", SIGNUP_BONUS, "Signup bonus")
    if referrer:
        await db.users.update_one({"user_id": referrer["user_id"]},
                                  {"$inc": {"balance": REFERRAL_REWARD, "total_earned": REFERRAL_REWARD}})
        await add_transaction(referrer["user_id"], "referral", REFERRAL_REWARD, f"Referral bonus — {data.name.strip()}")
    token = await create_session(user_id)
    fresh = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"token": token, "user": public_user(fresh)}


@api_router.post("/auth/login")
async def login(data: LoginInput):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["user_id"])
    return {"token": token, "user": public_user(user)}


@api_router.post("/auth/google-session")
async def google_session(data: GoogleSessionInput):
    async with httpx.AsyncClient(timeout=15) as hc:
        resp = await hc.get(f"{EMERGENT_AUTH_BASE}/auth/v1/env/oauth/session-data",
                            headers={"X-Session-ID": data.session_token})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    info = resp.json()
    email = info["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = new_id("user")
        user = {
            "user_id": user_id, "email": email, "name": info.get("name", email.split("@")[0]),
            "password_hash": None, "auth_provider": "google", "role": "user",
            "balance": float(SIGNUP_BONUS), "total_earned": float(SIGNUP_BONUS),
            "referral_code": gen_referral_code(), "referred_by": None,
            "picture": info.get("picture"), "created_at": iso(now_utc()),
        }
        await db.users.insert_one(dict(user))
        await add_transaction(user_id, "bonus", SIGNUP_BONUS, "Signup bonus")
    token = await create_session(user["user_id"])
    return {"token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        await db.user_sessions.delete_one({"session_token": authorization.split(" ", 1)[1].strip()})
    return {"success": True}


# ---------------- Config / Tasks ----------------
_usdt_cache = {"rate": USDT_FALLBACK_RATE, "ts": 0.0}


@api_router.get("/config")
async def get_config():
    return {"telegram": TELEGRAM_LINK, "support_telegram": SUPPORT_TELEGRAM,
            "beneficiary_name": BENEFICIARY_NAME,
            "payment_method": "UPI / QR", "usdt_address": USDT_ADDRESS}


@api_router.get("/rates/usdt-inr")
async def usdt_inr_rate():
    import time
    now = time.time()
    if now - _usdt_cache["ts"] < 60:
        return {"rate": _usdt_cache["rate"], "cached": True}
    try:
        async with httpx.AsyncClient(timeout=8) as hc:
            r = await hc.get("https://api.coingecko.com/api/v3/simple/price",
                             params={"ids": "tether", "vs_currencies": "inr"})
        rate = float(r.json()["tether"]["inr"])
        _usdt_cache["rate"] = round(rate, 2)
        _usdt_cache["ts"] = now
        return {"rate": _usdt_cache["rate"], "cached": False}
    except Exception:
        return {"rate": _usdt_cache["rate"], "cached": True, "fallback": True}


@api_router.get("/tasks")
async def list_tasks():
    tasks = await db.tasks.find({}, {"_id": 0}).sort([("level", 1), ("order", 1)]).to_list(300)
    return {"tasks": tasks}


@api_router.get("/tasks/my-payments")
async def my_payments(user: dict = Depends(get_current_user)):
    pays = await db.task_payments.find({"user_id": user["user_id"]}, {"_id": 0, "screenshot": 0}) \
        .sort("created_at", -1).to_list(300)
    return {"payments": pays}


@api_router.get("/plans/my")
async def my_plans(user: dict = Depends(get_current_user)):
    acts = await db.plan_activations.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"activations": acts}


@api_router.post("/tasks/pay")
async def pay_task(data: TaskPayInput, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"task_id": data.task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not data.screenshot or len(data.screenshot) < 50:
        raise HTTPException(status_code=400, detail="Please attach a valid payment screenshot")
    if not data.utr or len(data.utr.strip()) < 6:
        raise HTTPException(status_code=400, detail="Enter a valid UTR / Transaction ID")
    credit = round(task.get("final", task["amount"] + task["reward"]), 2)
    order_id = "VP" + "".join(random.choices(string.digits, k=10))
    req = {
        "payment_id": new_id("pay"), "order_id": order_id,
        "user_id": user["user_id"], "user_name": user["name"],
        "user_email": user["email"], "task_id": task["task_id"], "task_name": task["name"],
        "level": task.get("level"), "amount": task["amount"], "reward": task["reward"],
        "bonus": task.get("bonus", 0), "credit": credit,
        "utr": data.utr.strip(), "remarks": (data.remarks or "").strip(),
        "currency": data.currency or "INR", "usdt_amount": data.usdt_amount,
        "screenshot": data.screenshot, "method": data.method,
        "status": "pending", "note": None, "created_at": iso(now_utc()),
    }
    await db.task_payments.insert_one(req)
    out = {k: v for k, v in req.items() if k not in ("screenshot", "_id")}
    return {"payment": out}



# ---------------- Wallet ----------------
@api_router.get("/wallet/transactions")
async def transactions(user: dict = Depends(get_current_user)):
    txs = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"transactions": txs}


@api_router.get("/wallet/upi-info")
async def upi_info(user: dict = Depends(get_current_user)):
    cfg = await db.app_config.find_one({"key": "upi"}, {"_id": 0})
    val = cfg["value"] if cfg else {}
    return {"upi": {
        "upi_id": val.get("upi_id", BIG_PAYMENT_UPI),
        "upi_name": val.get("upi_name", "Victory Pay"),
        "beneficiary_name": BENEFICIARY_NAME,
        "payment_method": "UPI / QR Payment",
        "big_payment_upi": BIG_PAYMENT_UPI,
        "usdt_address": USDT_ADDRESS,
        "qr_images": val.get("qr_images", []),
    }}


@api_router.get("/accounts")
async def list_accounts(user: dict = Depends(get_current_user)):
    accts = await db.payout_accounts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"accounts": accts}


@api_router.post("/accounts")
async def add_account(data: AccountInput, user: dict = Depends(get_current_user)):
    if "@" not in data.upi_id:
        raise HTTPException(status_code=400, detail="Enter a valid UPI ID")
    acct = {
        "account_id": new_id("acc"), "user_id": user["user_id"], "method": data.method,
        "holder_name": data.holder_name.strip(), "upi_id": data.upi_id.strip(),
        "created_at": iso(now_utc()),
    }
    await db.payout_accounts.insert_one(acct)
    return {"account": clean(dict(acct))}


@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user: dict = Depends(get_current_user)):
    await db.payout_accounts.delete_one({"account_id": account_id, "user_id": user["user_id"]})
    return {"success": True}


@api_router.post("/wallet/withdraw")
async def withdraw(data: WithdrawInput, user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid amount")
    if user["balance"] < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    acct = await db.payout_accounts.find_one({"account_id": data.account_id, "user_id": user["user_id"]}, {"_id": 0})
    if not acct:
        raise HTTPException(status_code=400, detail="Select a valid payout account")
    req = {
        "request_id": new_id("wd"), "user_id": user["user_id"], "user_name": user["name"],
        "user_email": user["email"], "amount": round(data.amount, 2),
        "upi_id": acct["upi_id"], "method": acct["method"], "holder_name": acct["holder_name"],
        "status": "pending", "note": None, "created_at": iso(now_utc()),
    }
    await db.withdraw_requests.insert_one(req)
    return {"request": clean(dict(req))}


@api_router.get("/wallet/my-requests")
async def my_requests(user: dict = Depends(get_current_user)):
    wds = await db.withdraw_requests.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    pays = await db.task_payments.find({"user_id": user["user_id"]}, {"_id": 0, "screenshot": 0}) \
        .sort("created_at", -1).to_list(200)
    return {"withdrawals": wds, "payments": pays}


# ---------------- Referrals ----------------
@api_router.get("/referrals")
async def referrals(user: dict = Depends(get_current_user)):
    invited = await db.users.find({"referred_by": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    invited_list = [{"name": u["name"], "email": u["email"], "created_at": u["created_at"]} for u in invited]
    ref_txs = await db.transactions.find({"user_id": user["user_id"], "type": "referral"}, {"_id": 0}).to_list(1000)
    total = sum(t["amount"] for t in ref_txs)
    return {"referral_code": user["referral_code"], "total_earned": round(total, 2),
            "reward_per_referral": REFERRAL_REWARD, "count": len(invited_list), "invited": invited_list}


# ---------------- Live stats (randomised social proof) ----------------
FIRST_NAMES = ["Rahul", "Priya", "Amit", "Sneha", "Vikas", "Neha", "Arjun", "Pooja", "Rohit", "Kavya",
               "Sanjay", "Anjali", "Karan", "Divya", "Manish", "Ritu", "Suresh", "Meena", "Deepak",
               "Nisha", "Ajay", "Simran", "Vishal", "Aarav", "Ishaan", "Ananya", "Kabir", "Riya",
               "Harsh", "Tanvi", "Yash", "Payal", "Gaurav", "Shreya", "Nikhil", "Pallavi"]


def masked_name() -> str:
    n = random.choice(FIRST_NAMES)
    last = random.choice(string.ascii_uppercase)
    return f"{n} {last}***"


@api_router.get("/stats/live")
async def live_stats():
    seed_base = int(now_utc().timestamp() // 20)  # changes every 20s
    rnd = random.Random(seed_base)
    active = 12000 + rnd.randint(0, 4000) + (seed_base % 97)
    withdrawn = 11500000 + rnd.randint(0, 900000)
    payouts_today = 800 + rnd.randint(0, 500)
    recent = []
    for _ in range(8):
        amt = rnd.choice([520, 750, 1320, 900, 1250, 2080, 1560, 310, 210, 1830, 1250, 3120])
        recent.append({"name": masked_name(), "amount": amt, "ago": rnd.randint(1, 9)})
    return {"active_earners": active, "total_withdrawn": withdrawn,
            "payouts_today": payouts_today, "recent_withdrawals": recent}


# ---------------- Support ----------------
@api_router.get("/support/my")
async def support_my(user: dict = Depends(get_current_user)):
    msgs = await db.support_messages.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"messages": msgs}


@api_router.post("/support/send")
async def support_send(data: SupportSendInput, user: dict = Depends(get_current_user)):
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    msg = {"msg_id": new_id("msg"), "user_id": user["user_id"], "user_name": user["name"],
           "sender": "user", "text": data.text.strip(), "read_by_admin": False, "created_at": iso(now_utc())}
    await db.support_messages.insert_one(msg)
    return {"message": clean(dict(msg))}


# ---------------- Admin ----------------
@api_router.get("/admin/summary")
async def admin_summary(admin: dict = Depends(require_admin)):
    return {
        "total_users": await db.users.count_documents({}),
        "pending_payments": await db.task_payments.count_documents({"status": "pending"}),
        "pending_withdrawals": await db.withdraw_requests.count_documents({"status": "pending"}),
        "open_support": await db.support_messages.count_documents({"sender": "user", "read_by_admin": False}),
    }


@api_router.get("/admin/payments")
async def admin_payments(status: str = "pending", admin: dict = Depends(require_admin)):
    q = {} if status == "all" else {"status": status}
    reqs = await db.task_payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"payments": reqs}


@api_router.post("/admin/payments/{payment_id}/{action}")
async def admin_payment_action(payment_id: str, action: str, data: RequestActionInput,
                               admin: dict = Depends(require_admin)):
    req = await db.task_payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Payment not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Already processed")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action")
    if action == "approve":
        await db.users.update_one({"user_id": req["user_id"]},
                                  {"$inc": {"balance": req["credit"], "total_earned": req["reward"]}})
        await add_transaction(req["user_id"], "task", req["credit"], f"{req['task_name']} completed")
        await db.plan_activations.insert_one({
            "activation_id": new_id("act"), "user_id": req["user_id"], "task_id": req["task_id"],
            "plan_name": req["task_name"], "amount": req["amount"], "reward": req["reward"],
            "status": "active", "created_at": iso(now_utc()),
        })
        new_status = "approved"
    else:
        new_status = "rejected"
    await db.task_payments.update_one({"payment_id": payment_id},
                                      {"$set": {"status": new_status, "note": data.note, "processed_at": iso(now_utc())}})
    return {"success": True, "status": new_status}


@api_router.get("/admin/withdrawals")
async def admin_withdrawals(status: str = "pending", admin: dict = Depends(require_admin)):
    q = {} if status == "all" else {"status": status}
    reqs = await db.withdraw_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"withdrawals": reqs}


@api_router.post("/admin/withdrawals/{request_id}/{action}")
async def admin_withdraw_action(request_id: str, action: str, data: RequestActionInput,
                                admin: dict = Depends(require_admin)):
    req = await db.withdraw_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Already processed")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action")
    if action == "approve":
        target = await db.users.find_one({"user_id": req["user_id"]}, {"_id": 0})
        if target["balance"] < req["amount"]:
            raise HTTPException(status_code=400, detail="User has insufficient balance")
        await db.users.update_one({"user_id": req["user_id"]}, {"$inc": {"balance": -req["amount"]}})
        await add_transaction(req["user_id"], "withdraw", -req["amount"], "Withdrawal approved")
        new_status = "approved"
    else:
        new_status = "rejected"
    await db.withdraw_requests.update_one({"request_id": request_id},
                                          {"$set": {"status": new_status, "note": data.note, "processed_at": iso(now_utc())}})
    return {"success": True, "status": new_status}


@api_router.get("/admin/payments/{payment_id}/screenshot")
async def admin_payment_screenshot(payment_id: str, admin: dict = Depends(require_admin)):
    req = await db.task_payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"screenshot": req.get("screenshot")}


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return {"users": [public_user(u) for u in users]}


@api_router.get("/admin/support/threads")
async def admin_support_threads(admin: dict = Depends(require_admin)):
    pipeline = [
        {"$sort": {"created_at": 1}},
        {"$group": {"_id": "$user_id", "user_name": {"$last": "$user_name"},
                    "last_text": {"$last": "$text"}, "last_at": {"$last": "$created_at"},
                    "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$sender", "user"]},
                                                            {"$eq": ["$read_by_admin", False]}]}, 1, 0]}}}},
        {"$sort": {"last_at": -1}},
    ]
    threads = await db.support_messages.aggregate(pipeline).to_list(500)
    return {"threads": [{"user_id": t["_id"], "user_name": t["user_name"], "last_text": t["last_text"],
                         "last_at": t["last_at"], "unread": t["unread"]} for t in threads]}


@api_router.get("/admin/support/{user_id}")
async def admin_support_thread(user_id: str, admin: dict = Depends(require_admin)):
    msgs = await db.support_messages.find({"user_id": user_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.support_messages.update_many({"user_id": user_id, "sender": "user"}, {"$set": {"read_by_admin": True}})
    return {"messages": msgs}


@api_router.post("/admin/support/{user_id}")
async def admin_support_reply(user_id: str, data: SupportSendInput, admin: dict = Depends(require_admin)):
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    msg = {"msg_id": new_id("msg"), "user_id": user_id, "user_name": target["name"],
           "sender": "admin", "text": data.text.strip(), "read_by_admin": True, "created_at": iso(now_utc())}
    await db.support_messages.insert_one(msg)
    return {"message": clean(dict(msg))}


@api_router.get("/")
async def root():
    return {"message": "Victory Pay API"}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


# ---------------- Startup / Seed ----------------
# Amount ranges per level (L1..L7) — increasing order sizes.
LEVEL_AMOUNTS = {
    1: [300, 500, 700, 900, 1100],
    2: [800, 1000, 1200, 1400, 1600],
    3: [1200, 1500, 1800, 2100, 2400],
    4: [2000, 2400, 2800, 3200, 3600],
    5: [1546, 1934, 2000, 2554, 3000],
    6: [3500, 4200, 5000, 6000, 7000],
    7: [6500, 7500, 8500, 10000, 12000],
}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("referral_code")
    await db.user_sessions.create_index("session_token", unique=True)

    # Reseed tasks as L1-L7 levels
    await db.tasks.delete_many({})
    for level, amounts in LEVEL_AMOUNTS.items():
        rate = LEVEL_RATES[level]
        for order, amt in enumerate(amounts):
            reward = round(amt * rate, 2)
            final = round(amt + reward + LEVEL_BONUS, 2)
            await db.tasks.insert_one({
                "task_id": new_id("task"), "level": level, "name": f"L{level} Order",
                "amount": float(amt), "rate": rate, "reward": reward,
                "bonus": LEVEL_BONUS, "final": final,
                "quantity": random.randint(1, 20), "code": gen_task_code(), "order": order,
            })
    logger.info("Reseeded tasks with L1-L7 levels")

    # Admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not admin:
        await db.users.insert_one({
            "user_id": new_id("user"), "email": ADMIN_EMAIL.lower(), "name": "Admin",
            "password_hash": hash_password(ADMIN_PASSWORD), "auth_provider": "email", "role": "admin",
            "balance": 0.0, "total_earned": 0.0, "referral_code": gen_referral_code(),
            "referred_by": None, "picture": None, "created_at": iso(now_utc()),
        })
        logger.info("Seeded admin user")
    else:
        await db.users.update_one({"email": ADMIN_EMAIL.lower()}, {"$set": {"role": "admin"}})

    # UPI config with QR images (base64)
    qr_images = []
    for fname in ("qr1.jpg", "qr2.jpg", "qr3.jpg", "qr4.jpg"):
        fp = ROOT_DIR / "assets" / fname
        if fp.exists():
            b = base64.b64encode(fp.read_bytes()).decode()
            qr_images.append("data:image/jpeg;base64," + b)
    await db.app_config.update_one(
        {"key": "upi"},
        {"$set": {"value": {"upi_id": BIG_PAYMENT_UPI, "upi_name": "Victory Pay", "qr_images": qr_images}}},
        upsert=True,
    )
    logger.info("UPI config set with %d QR images", len(qr_images))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
