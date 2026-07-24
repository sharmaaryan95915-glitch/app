from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
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
PLAN_REWARD_RATE = 0.04
SESSION_DAYS = 30

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


async def add_transaction(user_id: str, tx_type: str, amount: float, title: str, meta: Optional[dict] = None):
    await db.transactions.insert_one({
        "tx_id": new_id("tx"),
        "user_id": user_id,
        "type": tx_type,  # bonus, referral, deposit, withdraw, plan, plan_reward
        "amount": round(amount, 2),
        "title": title,
        "meta": meta or {},
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


class ActivatePlanInput(BaseModel):
    plan_id: str


class DepositInput(BaseModel):
    amount: float
    upi_reference: str


class WithdrawInput(BaseModel):
    amount: float
    upi_id: str


class UpiConfigInput(BaseModel):
    upi_id: str
    upi_name: str
    qr_image: Optional[str] = None


class RequestActionInput(BaseModel):
    note: Optional[str] = None


# ---------------- Auth Routes ----------------
@api_router.post("/auth/register")
async def register(data: RegisterInput):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = new_id("user")
    referrer = None
    if data.referral_code:
        referrer = await db.users.find_one({"referral_code": data.referral_code.strip().upper()})

    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": data.name.strip(),
        "password_hash": hash_password(data.password),
        "auth_provider": "email",
        "role": "user",
        "balance": float(SIGNUP_BONUS),
        "total_earned": float(SIGNUP_BONUS),
        "referral_code": gen_referral_code(),
        "referred_by": referrer["user_id"] if referrer else None,
        "picture": None,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user_doc)
    await add_transaction(user_id, "bonus", SIGNUP_BONUS, "Signup bonus")

    if referrer:
        await db.users.update_one(
            {"user_id": referrer["user_id"]},
            {"$inc": {"balance": REFERRAL_REWARD, "total_earned": REFERRAL_REWARD}},
        )
        await add_transaction(referrer["user_id"], "referral", REFERRAL_REWARD,
                              f"Referral bonus — {data.name.strip()}")

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
        resp = await hc.get(
            f"{EMERGENT_AUTH_BASE}/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": data.session_token},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    info = resp.json()
    email = info["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = new_id("user")
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": info.get("name", email.split("@")[0]),
            "password_hash": None,
            "auth_provider": "google",
            "role": "user",
            "balance": float(SIGNUP_BONUS),
            "total_earned": float(SIGNUP_BONUS),
            "referral_code": gen_referral_code(),
            "referred_by": None,
            "picture": info.get("picture"),
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(user_doc)
        await add_transaction(user_id, "bonus", SIGNUP_BONUS, "Signup bonus")
        user = user_doc
    token = await create_session(user["user_id"])
    return {"token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"success": True}


# ---------------- Plans ----------------
@api_router.get("/plans")
async def list_plans():
    plans = await db.plans.find({}, {"_id": 0}).sort("amount", 1).to_list(100)
    return {"plans": plans}


@api_router.get("/plans/my")
async def my_plans(user: dict = Depends(get_current_user)):
    acts = await db.plan_activations.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"activations": acts}


@api_router.post("/plans/activate")
async def activate_plan(data: ActivatePlanInput, user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"plan_id": data.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    amount = float(plan["amount"])
    if user["balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance. Please deposit first.")
    reward = round(amount * PLAN_REWARD_RATE, 2)

    # Principal is locked into the active plan; the 4% reward is credited to spendable balance.
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"balance": reward - amount, "total_earned": reward}},
    )

    act = {
        "activation_id": new_id("act"),
        "user_id": user["user_id"],
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "amount": amount,
        "reward": reward,
        "status": "active",
        "created_at": iso(now_utc()),
    }
    await db.plan_activations.insert_one(act)
    act.pop("_id", None)
    await add_transaction(user["user_id"], "plan", -amount, f"Activated {plan['name']}")
    await add_transaction(user["user_id"], "plan_reward", reward, f"Reward — {plan['name']}")

    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"activation": act, "user": public_user(fresh)}


# ---------------- Wallet ----------------
@api_router.get("/wallet/transactions")
async def transactions(user: dict = Depends(get_current_user)):
    txs = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"transactions": txs}


@api_router.get("/wallet/upi-info")
async def upi_info(user: dict = Depends(get_current_user)):
    cfg = await db.app_config.find_one({"key": "upi"}, {"_id": 0})
    return {"upi": cfg["value"] if cfg else {}}


@api_router.post("/wallet/deposit")
async def deposit(data: DepositInput, user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid amount")
    req = {
        "request_id": new_id("dep"),
        "user_id": user["user_id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "amount": round(data.amount, 2),
        "upi_reference": data.upi_reference.strip(),
        "status": "pending",
        "note": None,
        "created_at": iso(now_utc()),
    }
    await db.deposit_requests.insert_one(req)
    req.pop("_id", None)
    return {"request": req}


@api_router.post("/wallet/withdraw")
async def withdraw(data: WithdrawInput, user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid amount")
    if user["balance"] < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    req = {
        "request_id": new_id("wd"),
        "user_id": user["user_id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "amount": round(data.amount, 2),
        "upi_id": data.upi_id.strip(),
        "status": "pending",
        "note": None,
        "created_at": iso(now_utc()),
    }
    await db.withdraw_requests.insert_one(req)
    req.pop("_id", None)
    return {"request": req}


@api_router.get("/wallet/my-requests")
async def my_requests(user: dict = Depends(get_current_user)):
    deps = await db.deposit_requests.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    wds = await db.withdraw_requests.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"deposits": deps, "withdrawals": wds}


# ---------------- Referrals ----------------
@api_router.get("/referrals")
async def referrals(user: dict = Depends(get_current_user)):
    invited = await db.users.find({"referred_by": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    invited_list = [{
        "name": u["name"],
        "email": u["email"],
        "created_at": u["created_at"],
    } for u in invited]
    ref_txs = await db.transactions.find(
        {"user_id": user["user_id"], "type": "referral"}, {"_id": 0}
    ).to_list(1000)
    total = sum(t["amount"] for t in ref_txs)
    return {
        "referral_code": user["referral_code"],
        "total_earned": round(total, 2),
        "reward_per_referral": REFERRAL_REWARD,
        "count": len(invited_list),
        "invited": invited_list,
    }


# ---------------- Admin ----------------
@api_router.get("/admin/summary")
async def admin_summary(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    pending_dep = await db.deposit_requests.count_documents({"status": "pending"})
    pending_wd = await db.withdraw_requests.count_documents({"status": "pending"})
    return {"total_users": total_users, "pending_deposits": pending_dep, "pending_withdrawals": pending_wd}


@api_router.get("/admin/deposits")
async def admin_deposits(status: str = "pending", admin: dict = Depends(require_admin)):
    q = {} if status == "all" else {"status": status}
    reqs = await db.deposit_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"deposits": reqs}


@api_router.get("/admin/withdrawals")
async def admin_withdrawals(status: str = "pending", admin: dict = Depends(require_admin)):
    q = {} if status == "all" else {"status": status}
    reqs = await db.withdraw_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"withdrawals": reqs}


@api_router.post("/admin/deposits/{request_id}/{action}")
async def admin_deposit_action(request_id: str, action: str, data: RequestActionInput,
                               admin: dict = Depends(require_admin)):
    req = await db.deposit_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action")

    if action == "approve":
        await db.users.update_one({"user_id": req["user_id"]}, {"$inc": {"balance": req["amount"]}})
        await add_transaction(req["user_id"], "deposit", req["amount"], "Deposit approved")
        new_status = "approved"
    else:
        new_status = "rejected"
    await db.deposit_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": new_status, "note": data.note, "processed_at": iso(now_utc())}},
    )
    return {"success": True, "status": new_status}


@api_router.post("/admin/withdrawals/{request_id}/{action}")
async def admin_withdraw_action(request_id: str, action: str, data: RequestActionInput,
                                admin: dict = Depends(require_admin)):
    req = await db.withdraw_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
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
    await db.withdraw_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": new_status, "note": data.note, "processed_at": iso(now_utc())}},
    )
    return {"success": True, "status": new_status}


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return {"users": [public_user(u) for u in users]}


@api_router.put("/admin/upi-info")
async def update_upi(data: UpiConfigInput, admin: dict = Depends(require_admin)):
    value = {"upi_id": data.upi_id, "upi_name": data.upi_name}
    if data.qr_image is not None:
        value["qr_image"] = data.qr_image
    else:
        existing = await db.app_config.find_one({"key": "upi"})
        if existing and existing.get("value", {}).get("qr_image"):
            value["qr_image"] = existing["value"]["qr_image"]
    await db.app_config.update_one({"key": "upi"}, {"$set": {"value": value}}, upsert=True)
    return {"upi": value}


@api_router.get("/")
async def root():
    return {"message": "Victory Pay API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Startup ----------------
DEFAULT_PLANS = [
    {"name": "Starter", "amount": 500, "tag": "Entry"},
    {"name": "Silver", "amount": 1000, "tag": "Popular"},
    {"name": "Gold", "amount": 2500, "tag": "Best Value"},
    {"name": "Platinum", "amount": 5000, "tag": "Premium"},
    {"name": "Victory Elite", "amount": 10000, "tag": "Max Rewards"},
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("referral_code")
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")

    # Seed plans
    if await db.plans.count_documents({}) == 0:
        for p in DEFAULT_PLANS:
            await db.plans.insert_one({
                "plan_id": new_id("plan"),
                "name": p["name"],
                "amount": p["amount"],
                "reward_rate": PLAN_REWARD_RATE,
                "reward": round(p["amount"] * PLAN_REWARD_RATE, 2),
                "tag": p["tag"],
            })
        logger.info("Seeded default plans")

    # Seed admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not admin:
        await db.users.insert_one({
            "user_id": new_id("user"),
            "email": ADMIN_EMAIL.lower(),
            "name": "Admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "auth_provider": "email",
            "role": "admin",
            "balance": 0.0,
            "total_earned": 0.0,
            "referral_code": gen_referral_code(),
            "referred_by": None,
            "picture": None,
            "created_at": iso(now_utc()),
        })
        logger.info("Seeded admin user")
    else:
        await db.users.update_one({"email": ADMIN_EMAIL.lower()}, {"$set": {"role": "admin"}})

    # Seed UPI config
    if not await db.app_config.find_one({"key": "upi"}):
        await db.app_config.insert_one({
            "key": "upi",
            "value": {
                "upi_id": "victorypay@okhdfcbank",
                "upi_name": "Victory Pay",
                "qr_image": "https://images.pexels.com/photos/278430/pexels-photo-278430.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            },
        })


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
