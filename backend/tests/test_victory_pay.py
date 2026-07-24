"""Victory Pay backend end-to-end tests (task-payment iteration).

Covers:
- Auth (register/login/admin/google invalid/me/logout)
- Tasks list (reward + daily)
- Task payment flow (pay -> admin approve credits amount+reward; reject doesn't credit)
- Screenshot validation
- Payout Accounts CRUD + UPI validation
- Withdraw new flow with account_id + admin approve
- Support chat (user + admin) + non-admin 403
- Live stats
- Wallet UPI info (big_payment_upi + qr_images len 2)
- Config (telegram)
- Full e2e: register -> pay 1200 task -> approve -> +1320 -> add account -> withdraw 500 -> approve -> -500
"""
import uuid
import pytest


def rand_email(prefix="test"):
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


class TestVictoryPay:
    state = {}

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
        assert j["total_earned"] >= 300
        assert j["count"] >= 1

    # ---------- Config / Tasks / UPI ----------
    def test_20_config(self, api, base_url):
        r = api.get(f"{base_url}/config")
        assert r.status_code == 200
        assert "t.me" in r.json()["telegram"]

    def test_21_tasks_list(self, api, base_url):
        r = api.get(f"{base_url}/tasks")
        assert r.status_code == 200
        j = r.json()
        assert "reward" in j and "daily" in j
        # Reward amounts must include the specified set
        reward_amts = {t["amount"] for t in j["reward"]}
        for a in (1200, 1900, 2600, 3500, 6500, 8500):
            assert a in reward_amts, f"Missing reward amount {a}"
        # Trending 3500 with reward 750
        elite = next(t for t in j["reward"] if t["amount"] == 3500)
        assert elite["reward"] == 750
        assert elite.get("trending") is True
        # Daily tasks 4% reward
        for t in j["daily"]:
            assert t["reward"] == round(t["amount"] * 0.04)
            assert t["code"].startswith("VP-")
        # Save a 1200 task for e2e
        self.state["task_1200"] = next(t for t in j["reward"] if t["amount"] == 1200)

    def test_22_upi_info(self, api, base_url):
        r = api.get(f"{base_url}/wallet/upi-info",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        upi = r.json()["upi"]
        assert upi["big_payment_upi"] == "harsh.g216@ptyes"
        assert isinstance(upi.get("qr_images"), list)
        assert len(upi["qr_images"]) == 2

    def test_23_live_stats(self, api, base_url):
        r = api.get(f"{base_url}/stats/live")
        assert r.status_code == 200
        j = r.json()
        for k in ("active_earners", "total_withdrawn", "payouts_today", "recent_withdrawals"):
            assert k in j
        assert len(j["recent_withdrawals"]) >= 1
        assert "***" in j["recent_withdrawals"][0]["name"]

    # ---------- Task payments ----------
    def test_30_pay_task_bad_screenshot(self, api, base_url):
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_1200"]["task_id"],
                           "screenshot": "short", "method": "phonepe"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400

    def test_31_pay_task_ok(self, api, base_url):
        big_ss = "data:image/jpeg;base64," + ("A" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_1200"]["task_id"],
                           "screenshot": big_ss, "method": "phonepe"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200, r.text
        pay = r.json()["payment"]
        assert pay["status"] == "pending"
        assert pay["credit"] == 1320
        assert "screenshot" not in pay  # scrubbed from response
        self.state["pay_id"] = pay["payment_id"]

    def test_32_admin_payments_list(self, api, base_url):
        r = api.get(f"{base_url}/admin/payments?status=pending",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        pays = r.json()["payments"]
        found = next(p for p in pays if p["payment_id"] == self.state["pay_id"])
        assert found["screenshot"].startswith("data:image/")

    def test_33_admin_payment_reject_does_not_credit(self, api, base_url):
        # create another user + payment, reject it, ensure balance unchanged
        email = rand_email("rej")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "Rej", "email": email, "password": "pass1234"})
        tok = r.json()["token"]
        big_ss = "data:image/jpeg;base64," + ("B" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_1200"]["task_id"],
                           "screenshot": big_ss, "method": "gpay"},
                     headers={"Authorization": f"Bearer {tok}"})
        pid = r.json()["payment"]["payment_id"]
        r = api.post(f"{base_url}/admin/payments/{pid}/reject",
                     json={"note": "bad ss"},
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
        r = api.get(f"{base_url}/auth/me",
                    headers={"Authorization": f"Bearer {tok}"})
        assert r.json()["user"]["balance"] == 70.0

    def test_34_admin_payment_approve_credits(self, api, base_url):
        r = api.post(f"{base_url}/admin/payments/{self.state['pay_id']}/approve",
                     json={"note": "ok"},
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        r = api.get(f"{base_url}/auth/me",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        bal = r.json()["user"]["balance"]
        # Started at 70+300=370, task credit 1320 -> 1690
        assert bal >= 1690 - 0.01

        # plan_activation should exist
        r = api.get(f"{base_url}/plans/my",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        acts = r.json()["activations"]
        assert any(a["task_id"] == self.state["task_1200"]["task_id"] for a in acts)

    # ---------- Payout Accounts ----------
    def test_40_add_account_invalid_upi(self, api, base_url):
        r = api.post(f"{base_url}/accounts",
                     json={"method": "PhonePe", "holder_name": "Reg", "upi_id": "notaupi"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400

    def test_41_add_account_ok(self, api, base_url):
        r = api.post(f"{base_url}/accounts",
                     json={"method": "PhonePe", "holder_name": "Reg", "upi_id": "reg@upi"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        acc = r.json()["account"]
        assert acc["upi_id"] == "reg@upi"
        self.state["acc_id"] = acc["account_id"]

    def test_42_list_accounts(self, api, base_url):
        r = api.get(f"{base_url}/accounts",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        assert any(a["account_id"] == self.state["acc_id"] for a in r.json()["accounts"])

    # ---------- Withdraw ----------
    def test_50_withdraw_invalid_account(self, api, base_url):
        r = api.post(f"{base_url}/wallet/withdraw",
                     json={"amount": 100, "account_id": "acc_bogus"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400

    def test_51_withdraw_insufficient(self, api, base_url):
        r = api.post(f"{base_url}/wallet/withdraw",
                     json={"amount": 999999, "account_id": self.state["acc_id"]},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400

    def test_52_withdraw_ok_and_admin_approve(self, api, base_url):
        r = api.post(f"{base_url}/wallet/withdraw",
                     json={"amount": 500, "account_id": self.state["acc_id"]},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200, r.text
        wd_id = r.json()["request"]["request_id"]

        r0 = api.get(f"{base_url}/auth/me",
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        bal_before = r0.json()["user"]["balance"]

        r = api.post(f"{base_url}/admin/withdrawals/{wd_id}/approve",
                     json={"note": "ok"},
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200

        r = api.get(f"{base_url}/auth/me",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert abs(r.json()["user"]["balance"] - (bal_before - 500)) < 0.01

    # ---------- Support ----------
    def test_60_support_send_empty(self, api, base_url):
        r = api.post(f"{base_url}/support/send", json={"text": "   "},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400

    def test_61_support_send_and_list(self, api, base_url):
        r = api.post(f"{base_url}/support/send", json={"text": "Hello support"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        r = api.get(f"{base_url}/support/my",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        assert any(m["text"] == "Hello support" for m in r.json()["messages"])

    def test_62_admin_support_threads_and_reply(self, api, base_url):
        r = api.get(f"{base_url}/admin/support/threads",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        threads = r.json()["threads"]
        my_uid = self.state["reg_user"]["user_id"]
        assert any(t["user_id"] == my_uid for t in threads)

        r = api.get(f"{base_url}/admin/support/{my_uid}",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200

        r = api.post(f"{base_url}/admin/support/{my_uid}",
                     json={"text": "Admin reply"},
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200

        # user sees reply
        r = api.get(f"{base_url}/support/my",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert any(m["text"] == "Admin reply" and m["sender"] == "admin"
                   for m in r.json()["messages"])

    def test_63_non_admin_blocked_on_admin_support(self, api, base_url):
        h = {"Authorization": f"Bearer {self.state['reg_token']}"}
        assert api.get(f"{base_url}/admin/support/threads", headers=h).status_code == 403
        assert api.get(f"{base_url}/admin/support/{self.state['reg_user']['user_id']}",
                       headers=h).status_code == 403
        assert api.post(f"{base_url}/admin/support/{self.state['reg_user']['user_id']}",
                        json={"text": "x"}, headers=h).status_code == 403
        assert api.get(f"{base_url}/admin/payments", headers=h).status_code == 403
        assert api.get(f"{base_url}/admin/withdrawals", headers=h).status_code == 403
        assert api.get(f"{base_url}/admin/users", headers=h).status_code == 403

    # ---------- Full e2e ----------
    def test_70_e2e_task_flow(self, api, base_url):
        email = rand_email("e2e")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "E2E", "email": email, "password": "pass1234"})
        tok = r.json()["token"]
        auth = {"Authorization": f"Bearer {tok}"}
        admin_h = {"Authorization": f"Bearer {self.state['admin_token']}"}

        # pay 1200 task
        big_ss = "data:image/jpeg;base64," + ("C" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_1200"]["task_id"],
                           "screenshot": big_ss, "method": "phonepe"},
                     headers=auth)
        pay_id = r.json()["payment"]["payment_id"]

        # approve => +1320
        r = api.post(f"{base_url}/admin/payments/{pay_id}/approve",
                     json={"note": "ok"}, headers=admin_h)
        assert r.status_code == 200

        r = api.get(f"{base_url}/auth/me", headers=auth)
        assert abs(r.json()["user"]["balance"] - (70 + 1320)) < 0.01

        # add payout account
        r = api.post(f"{base_url}/accounts",
                     json={"method": "GPay", "holder_name": "E2E", "upi_id": "e2e@upi"},
                     headers=auth)
        acc_id = r.json()["account"]["account_id"]

        # withdraw 500
        r = api.post(f"{base_url}/wallet/withdraw",
                     json={"amount": 500, "account_id": acc_id}, headers=auth)
        wd_id = r.json()["request"]["request_id"]

        r = api.post(f"{base_url}/admin/withdrawals/{wd_id}/approve",
                     json={"note": "ok"}, headers=admin_h)
        assert r.status_code == 200

        r = api.get(f"{base_url}/auth/me", headers=auth)
        assert abs(r.json()["user"]["balance"] - (70 + 1320 - 500)) < 0.01

    def test_80_logout_invalidates(self, api, base_url):
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
