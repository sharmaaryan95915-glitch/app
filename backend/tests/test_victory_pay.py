"""Victory Pay backend end-to-end tests (LIGHT green fintech redesign iteration).

Covers:
- Auth (register/login/admin/google invalid/me/logout)
- Config (telegram, beneficiary_name, payment_method, usdt_address)
- USDT->INR live rate
- Tasks list: 35 tasks across L1-L7 with amount/rate/reward/bonus/final/quantity/code
- Wallet UPI info (beneficiary_name, big_payment_upi='harsh.g216@ptyes', usdt_address, qr_images len 2)
- Task payment flow: UTR + screenshot required; credit=task.final; currency INR/USDT + remarks
- Admin approve/reject: approve credits balance by task.final and total_earned by reward; reject doesn't credit
- Screenshot viewable via /admin/payments
- Payout accounts CRUD + withdraw + admin approve deducts
- Support chat + non-admin 403 + referrals
- Full e2e: login test1 -> pay L5 (amount 1546) -> admin approve -> +1599.29
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

    # ---------- Config / Rates / UPI / Tasks ----------
    def test_20_config(self, api, base_url):
        r = api.get(f"{base_url}/config")
        assert r.status_code == 200
        j = r.json()
        assert "t.me" in j["telegram"]
        assert j["beneficiary_name"]
        assert j["payment_method"]
        assert j["usdt_address"]

    def test_21_usdt_inr_rate(self, api, base_url):
        r = api.get(f"{base_url}/rates/usdt-inr")
        assert r.status_code == 200
        j = r.json()
        assert isinstance(j.get("rate"), (int, float))
        assert j["rate"] > 0

    def test_22_tasks_list_L1_L7(self, api, base_url):
        r = api.get(f"{base_url}/tasks")
        assert r.status_code == 200
        j = r.json()
        assert "tasks" in j
        tasks = j["tasks"]
        assert len(tasks) == 35, f"Expected 35 tasks, got {len(tasks)}"
        # Group by level
        by_level = {}
        for t in tasks:
            by_level.setdefault(t["level"], []).append(t)
            for k in ("amount", "rate", "reward", "bonus", "final", "quantity", "code"):
                assert k in t, f"Missing field {k} in task"
            assert t["bonus"] == 10 or t["bonus"] == 10.0
            # final = amount + reward + bonus
            expected_final = round(t["amount"] + t["reward"] + t["bonus"], 2)
            assert abs(t["final"] - expected_final) < 0.01
            # reward = amount * rate
            expected_reward = round(t["amount"] * t["rate"], 2)
            assert abs(t["reward"] - expected_reward) < 0.01
            assert t["code"].startswith("VP-")
        for lvl in range(1, 8):
            assert lvl in by_level, f"Missing level {lvl}"
            assert len(by_level[lvl]) == 5, f"Level {lvl} should have 5 tasks"
        # Rates check
        expected_rates = {1: 0.020, 2: 0.022, 3: 0.024, 4: 0.026, 5: 0.028, 6: 0.030, 7: 0.035}
        for lvl, rate in expected_rates.items():
            assert abs(by_level[lvl][0]["rate"] - rate) < 1e-6

        # Save an L5 amount=1546 task for e2e
        l5_1546 = next((t for t in by_level[5] if t["amount"] == 1546), None)
        assert l5_1546 is not None, "Expected L5 task with amount 1546"
        # 1546 * 0.028 = 43.288 -> 43.29
        assert abs(l5_1546["reward"] - 43.29) < 0.01
        assert abs(l5_1546["final"] - 1599.29) < 0.01
        self.state["task_l5"] = l5_1546

    def test_23_upi_info(self, api, base_url):
        r = api.get(f"{base_url}/wallet/upi-info",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        upi = r.json()["upi"]
        assert upi["big_payment_upi"] == "harsh.g216@ptyes"
        assert upi["beneficiary_name"]
        assert upi["payment_method"]
        assert upi["usdt_address"]
        assert isinstance(upi.get("qr_images"), list)
        assert len(upi["qr_images"]) == 2

    def test_24_live_stats(self, api, base_url):
        r = api.get(f"{base_url}/stats/live")
        assert r.status_code == 200
        j = r.json()
        for k in ("active_earners", "total_withdrawn", "payouts_today", "recent_withdrawals"):
            assert k in j

    # ---------- Task payments ----------
    def test_30_pay_task_missing_screenshot(self, api, base_url):
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_l5"]["task_id"],
                           "screenshot": "short", "utr": "123456789012"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400
        assert "screenshot" in r.text.lower()

    def test_31_pay_task_missing_utr(self, api, base_url):
        big_ss = "data:image/jpeg;base64," + ("A" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_l5"]["task_id"],
                           "screenshot": big_ss, "utr": "12345"},  # <6 chars
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 400
        assert "utr" in r.text.lower() or "transaction" in r.text.lower()

    def test_32_pay_task_ok_with_utr_and_currency(self, api, base_url):
        big_ss = "data:image/jpeg;base64," + ("A" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_l5"]["task_id"],
                           "screenshot": big_ss, "utr": "123456789012",
                           "remarks": "test remarks",
                           "currency": "INR"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200, r.text
        pay = r.json()["payment"]
        assert pay["status"] == "pending"
        assert abs(pay["credit"] - 1599.29) < 0.01
        assert pay["utr"] == "123456789012"
        assert pay["remarks"] == "test remarks"
        assert pay["currency"] == "INR"
        assert "screenshot" not in pay  # scrubbed
        self.state["pay_id"] = pay["payment_id"]

    def test_33_pay_task_usdt_currency(self, api, base_url):
        big_ss = "data:image/jpeg;base64," + ("B" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_l5"]["task_id"],
                           "screenshot": big_ss, "utr": "USDT98765432",
                           "currency": "USDT", "usdt_amount": 17.5},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200, r.text
        pay = r.json()["payment"]
        assert pay["currency"] == "USDT"
        assert pay["usdt_amount"] == 17.5

    def test_34_admin_payments_screenshot_visible(self, api, base_url):
        r = api.get(f"{base_url}/admin/payments?status=pending",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        pays = r.json()["payments"]
        found = next(p for p in pays if p["payment_id"] == self.state["pay_id"])
        assert found["screenshot"].startswith("data:image/")
        assert found["utr"] == "123456789012"

    def test_35_admin_reject_does_not_credit(self, api, base_url):
        email = rand_email("rej")
        r = api.post(f"{base_url}/auth/register",
                     json={"name": "Rej", "email": email, "password": "pass1234"})
        tok = r.json()["token"]
        big_ss = "data:image/jpeg;base64," + ("R" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_l5"]["task_id"],
                           "screenshot": big_ss, "utr": "REJ123456789"},
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

    def test_36_admin_approve_credits_final_and_reward(self, api, base_url):
        r0 = api.get(f"{base_url}/auth/me",
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        bal_before = r0.json()["user"]["balance"]
        te_before = r0.json()["user"]["total_earned"]

        r = api.post(f"{base_url}/admin/payments/{self.state['pay_id']}/approve",
                     json={"note": "ok"},
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        r = api.get(f"{base_url}/auth/me",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        u = r.json()["user"]
        # balance += final (1599.29); total_earned += reward (43.29)
        assert abs(u["balance"] - (bal_before + 1599.29)) < 0.01
        assert abs(u["total_earned"] - (te_before + 43.29)) < 0.01

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

    def test_52_withdraw_ok_admin_approve_deducts(self, api, base_url):
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
    def test_60_support_send_and_list(self, api, base_url):
        r = api.post(f"{base_url}/support/send", json={"text": "Hello support"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        r = api.get(f"{base_url}/support/my",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        assert any(m["text"] == "Hello support" for m in r.json()["messages"])

    def test_61_admin_support_threads_and_reply(self, api, base_url):
        r = api.get(f"{base_url}/admin/support/threads",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        my_uid = self.state["reg_user"]["user_id"]
        r = api.post(f"{base_url}/admin/support/{my_uid}",
                     json={"text": "Admin reply"},
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200

    def test_62_non_admin_blocked(self, api, base_url):
        h = {"Authorization": f"Bearer {self.state['reg_token']}"}
        assert api.get(f"{base_url}/admin/payments", headers=h).status_code == 403
        assert api.get(f"{base_url}/admin/withdrawals", headers=h).status_code == 403
        assert api.get(f"{base_url}/admin/users", headers=h).status_code == 403

    # ---------- Full e2e: login test1 -> pay L5 1546 -> approve -> +1599.29 ----------
    def test_70_e2e_l5_task_flow_test1(self, api, base_url):
        # Ensure test1@example.com exists (idempotent)
        api.post(f"{base_url}/auth/register",
                 json={"name": "Test1", "email": "test1@example.com", "password": "pass123"})
        r = api.post(f"{base_url}/auth/login",
                     json={"email": "test1@example.com", "password": "pass123"})
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        bal_before = r.json()["user"]["balance"]
        auth = {"Authorization": f"Bearer {tok}"}
        admin_h = {"Authorization": f"Bearer {self.state['admin_token']}"}

        big_ss = "data:image/jpeg;base64," + ("E" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": self.state["task_l5"]["task_id"],
                           "screenshot": big_ss, "utr": "123456789012",
                           "currency": "INR"},
                     headers=auth)
        assert r.status_code == 200, r.text
        pay_id = r.json()["payment"]["payment_id"]

        r = api.post(f"{base_url}/admin/payments/{pay_id}/approve",
                     json={"note": "ok"}, headers=admin_h)
        assert r.status_code == 200

        r = api.get(f"{base_url}/auth/me", headers=auth)
        assert abs(r.json()["user"]["balance"] - (bal_before + 1599.29)) < 0.01, \
            f"Expected balance +1599.29, before={bal_before}, after={r.json()['user']['balance']}"

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
