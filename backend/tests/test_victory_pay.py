"""Victory Pay backend end-to-end tests.

All tests grouped in a single class so pytest-xdist loadscope keeps them
on the same worker (shared cls.state dict is safe).
"""
import uuid
import pytest


def rand_email(prefix="test"):
    # Backend lowercases email; keep lowercase for equality checks.
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


class TestVictoryPay:
    state = {}  # shared across tests in this class

    # ---------- Health ----------
    def test_00_root(self, api, base_url):
        r = api.get(f"{base_url}/")
        assert r.status_code == 200
        assert "Victory Pay" in r.json().get("message", "")

    # ---------- Auth ----------
    def test_01_register_signup_bonus(self, api, base_url):
        email = rand_email("reg")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "Reg User", "email": email, "password": "pass1234"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["balance"] == 70.0
        assert d["user"]["role"] == "user"
        assert d["user"]["referral_code"]
        self.state["reg_email"] = email
        self.state["reg_token"] = d["token"]
        self.state["reg_user"] = d["user"]

    def test_02_register_duplicate(self, api, base_url):
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "Dup", "email": self.state["reg_email"], "password": "pass1234"})
        assert r.status_code == 400

    def test_03_login_success(self, api, base_url):
        r = api.post(f"{base_url}/auth/login",
                     json={"email": self.state["reg_email"], "password": "pass1234"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_04_login_invalid(self, api, base_url):
        r = api.post(f"{base_url}/auth/login",
                     json={"email": self.state["reg_email"], "password": "wrong"})
        assert r.status_code == 401

    def test_05_me(self, api, base_url):
        r = api.get(f"{base_url}/auth/me",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == self.state["reg_email"]

    def test_06_me_no_token(self, api, base_url):
        r = api.get(f"{base_url}/auth/me")
        assert r.status_code == 401

    def test_07_admin_login(self, api, base_url):
        r = api.post(f"{base_url}/auth/login",
                     json={"email": "admin@victorypay.com", "password": "Admin@123"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["user"]["role"] == "admin"
        self.state["admin_token"] = j["token"]

    def test_08_google_session_invalid(self, api, base_url):
        r = api.post(f"{base_url}/auth/google-session",
                     json={"session_token": "invalid_fake_token_xyz_123"})
        assert r.status_code == 401

    # ---------- Referrals ----------
    def test_10_referral_credits_referrer(self, api, base_url):
        code = self.state["reg_user"]["referral_code"]
        new_email = rand_email("ref")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "Referred", "email": new_email, "password": "pass1234",
                           "referral_code": code})
        assert r.status_code == 200
        r2 = api.get(f"{base_url}/auth/me",
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        bal = r2.json()["user"]["balance"]
        assert bal >= 70 + 300, f"Expected >=370, got {bal}"

    def test_11_referrals_endpoint(self, api, base_url):
        r = api.get(f"{base_url}/referrals",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        j = r.json()
        assert j["referral_code"] == self.state["reg_user"]["referral_code"]
        assert j["total_earned"] >= 300
        assert j["count"] >= 1

    # ---------- Plans ----------
    def test_20_list_plans(self, api, base_url):
        r = api.get(f"{base_url}/plans")
        assert r.status_code == 200
        plans = r.json()["plans"]
        assert len(plans) >= 5
        self.state["plan_starter"] = next(p for p in plans if p["amount"] == 500)

    def test_21_activate_insufficient(self, api, base_url):
        email = rand_email("poor")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "Poor", "email": email, "password": "pass1234"})
        tok = r.json()["token"]
        r2 = api.post(f"{base_url}/plans/activate",
                      json={"plan_id": self.state["plan_starter"]["plan_id"]},
                      headers={"Authorization": f"Bearer {tok}"})
        assert r2.status_code == 400

    # ---------- Wallet ----------
    def test_30_upi_info(self, api, base_url):
        r = api.get(f"{base_url}/wallet/upi-info",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        upi = r.json()["upi"]
        assert upi.get("upi_id")

    def test_31_deposit_request(self, api, base_url):
        r = api.post(f"{base_url}/wallet/deposit",
                     json={"amount": 1000, "upi_reference": "TXN123ABC"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        req = r.json()["request"]
        assert req["status"] == "pending"
        assert req["amount"] == 1000
        self.state["deposit_id"] = req["request_id"]

    def test_32_deposit_invalid_amount(self, api, base_url):
        r = api.post(f"{base_url}/wallet/deposit",
                     json={"amount": 0, "upi_reference": "X"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400

    def test_33_my_requests(self, api, base_url):
        r = api.get(f"{base_url}/wallet/my-requests",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        assert any(d["request_id"] == self.state["deposit_id"] for d in r.json()["deposits"])

    def test_34_withdraw_insufficient(self, api, base_url):
        r = api.post(f"{base_url}/wallet/withdraw",
                     json={"amount": 100000, "upi_id": "user@upi"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400

    def test_35_transactions(self, api, base_url):
        r = api.get(f"{base_url}/wallet/transactions",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        types = {t["type"] for t in r.json()["transactions"]}
        assert "bonus" in types
        assert "referral" in types

    # ---------- Admin ----------
    def test_40_non_admin_forbidden(self, api, base_url):
        r = api.get(f"{base_url}/admin/summary",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 403

    def test_41_admin_summary(self, api, base_url):
        r = api.get(f"{base_url}/admin/summary",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        j = r.json()
        assert "total_users" in j and "pending_deposits" in j

    def test_42_admin_deposits(self, api, base_url):
        r = api.get(f"{base_url}/admin/deposits",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        assert any(d["request_id"] == self.state["deposit_id"] for d in r.json()["deposits"])

    def test_43_admin_users(self, api, base_url):
        r = api.get(f"{base_url}/admin/users",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        assert len(r.json()["users"]) >= 1

    # ---------- End-to-end ----------
    def test_50_e2e_money_flow(self, api, base_url):
        email = rand_email("e2e")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "E2E", "email": email, "password": "pass1234"})
        assert r.status_code == 200
        tok = r.json()["token"]
        auth = {"Authorization": f"Bearer {tok}"}
        admin_h = {"Authorization": f"Bearer {self.state['admin_token']}"}

        # Deposit
        r = api.post(f"{base_url}/wallet/deposit",
                     json={"amount": 2000, "upi_reference": "E2ETXN"}, headers=auth)
        dep_id = r.json()["request"]["request_id"]

        # Approve
        r = api.post(f"{base_url}/admin/deposits/{dep_id}/approve",
                     json={"note": "ok"}, headers=admin_h)
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        r = api.get(f"{base_url}/auth/me", headers=auth)
        assert r.json()["user"]["balance"] == 2070.0

        # Activate Starter plan (500) => reward 20 => balance = 2070-500+20 = 1590
        r = api.post(f"{base_url}/plans/activate",
                     json={"plan_id": self.state["plan_starter"]["plan_id"]},
                     headers=auth)
        assert r.status_code == 200, r.text
        assert abs(r.json()["user"]["balance"] - 1590.0) < 0.01

        # Withdraw 500
        r = api.post(f"{base_url}/wallet/withdraw",
                     json={"amount": 500, "upi_id": "user@upi"}, headers=auth)
        wd_id = r.json()["request"]["request_id"]
        r = api.post(f"{base_url}/admin/withdrawals/{wd_id}/approve",
                     json={"note": "ok"}, headers=admin_h)
        assert r.status_code == 200

        r = api.get(f"{base_url}/auth/me", headers=auth)
        assert abs(r.json()["user"]["balance"] - 1090.0) < 0.01

    def test_51_reject_deposit(self, api, base_url):
        email = rand_email("reject")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "R", "email": email, "password": "pass1234"})
        tok = r.json()["token"]
        r = api.post(f"{base_url}/wallet/deposit",
                     json={"amount": 500, "upi_reference": "REJTXN"},
                     headers={"Authorization": f"Bearer {tok}"})
        dep_id = r.json()["request"]["request_id"]
        admin_h = {"Authorization": f"Bearer {self.state['admin_token']}"}
        r = api.post(f"{base_url}/admin/deposits/{dep_id}/reject",
                     json={"note": "bad"}, headers=admin_h)
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
        r = api.get(f"{base_url}/auth/me",
                    headers={"Authorization": f"Bearer {tok}"})
        assert r.json()["user"]["balance"] == 70.0

    def test_60_logout_invalidates(self, api, base_url):
        email = rand_email("lo")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "L", "email": email, "password": "pass1234"})
        tok = r.json()["token"]
        r = api.post(f"{base_url}/auth/logout",
                     headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        r = api.get(f"{base_url}/auth/me",
                    headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 401
