"""Victory Pay backend tests — Onboarding + New-User plans + Admin new-order alert iteration.

Highlights of THIS iteration (Jan 2026):
- Task list: 7 New-User plans (level 0, new_user=true) + 35 tasks across L1..L7 = 42 total.
- Levels range: ₹500 (L1 min) up to ₹20000 (L7 max).
- POST /api/tasks/pay creates payment with status=pending, seen_by_admin=false, and returns order_id.
- GET /api/admin/summary now includes `new_orders` = unseen payments count.
- POST /api/admin/notifications/seen flips all payments' seen_by_admin -> true and returns 0 next time.
- Admin approve credits balance += task.final and total_earned += task.reward.
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
        assert d["user"].get("user_id")
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

    def test_22_tasks_list_new_user_plus_L1_L7(self, api, base_url):
        """Assert: 7 New-User plans (level 0, new_user true) + 5 tasks per L1..L7.
        Level range: ₹500 (L1 min) .. ₹20000 (L7 max)."""
        r = api.get(f"{base_url}/tasks")
        assert r.status_code == 200
        tasks = r.json()["tasks"]
        assert len(tasks) == 42, f"Expected 42 tasks (7 new-user + 35 L1-L7), got {len(tasks)}"

        by_level = {}
        for t in tasks:
            by_level.setdefault(t["level"], []).append(t)
            for k in ("amount", "rate", "reward", "bonus", "final", "quantity", "code", "task_id", "new_user"):
                assert k in t, f"Missing field {k} in task"

        # New User plans (level 0)
        assert 0 in by_level and len(by_level[0]) == 7, "Expected 7 New-User plans (level 0)"
        for t in by_level[0]:
            assert t["new_user"] is True
            assert t["name"] == "New User Special"
            assert t["bonus"] == 0.0
            # final = amount + reward (bonus=0 for new-user)
            assert abs(t["final"] - (t["amount"] + t["reward"])) < 0.01

        # L1..L7 tiers
        for lvl in range(1, 8):
            assert lvl in by_level and len(by_level[lvl]) == 5, f"Level {lvl} should have 5 tasks"
            for t in by_level[lvl]:
                assert t["new_user"] is False
                assert t["bonus"] == 10 or t["bonus"] == 10.0
                # final = amount + reward + bonus(10)
                assert abs(t["final"] - round(t["amount"] + t["reward"] + t["bonus"], 2)) < 0.01
                # reward = amount * rate
                assert abs(t["reward"] - round(t["amount"] * t["rate"], 2)) < 0.01

        # Amount range boundaries: L1 has ₹500, L7 has ₹20000
        l1_amounts = sorted(t["amount"] for t in by_level[1])
        l7_amounts = sorted(t["amount"] for t in by_level[7])
        assert l1_amounts[0] == 500, f"L1 min should be ₹500, got {l1_amounts[0]}"
        assert l7_amounts[-1] == 20000, f"L7 max should be ₹20000, got {l7_amounts[-1]}"

        # Pick an L5 task for downstream e2e (deterministic: lowest amount)
        l5 = sorted(by_level[5], key=lambda t: t["amount"])[0]
        self.state["task_l5"] = l5
        # Also save a New-User plan for onboarding-style test coverage
        self.state["task_new_user"] = by_level[0][0]

    def test_23_upi_info(self, api, base_url):
        r = api.get(f"{base_url}/wallet/upi-info",
                    headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200
        upi = r.json()["upi"]
        # big_payment_upi is env-configured; just validate presence + shape
        assert upi["big_payment_upi"] and "@" in upi["big_payment_upi"]
        assert upi["beneficiary_name"]
        assert upi["payment_method"]
        assert upi["usdt_address"]
        assert isinstance(upi.get("qr_images"), list)
        assert len(upi["qr_images"]) >= 2, f"Expected >=2 QR images, got {len(upi['qr_images'])}"

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

    def test_32_pay_task_ok_returns_order_id_and_pending(self, api, base_url):
        """POST /api/tasks/pay -> status=pending, seen_by_admin=false, order_id returned."""
        big_ss = "data:image/jpeg;base64," + ("A" * 200)
        task = self.state["task_l5"]
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": task["task_id"],
                           "screenshot": big_ss, "utr": "123456789012",
                           "remarks": "test remarks",
                           "currency": "INR"},
                     headers={"Authorization": f"Bearer {self.state['reg_token']}"})
        assert r.status_code == 200, r.text
        pay = r.json()["payment"]
        assert pay["status"] == "pending"
        assert pay.get("seen_by_admin") is False, f"seen_by_admin must be false, got {pay.get('seen_by_admin')}"
        assert pay.get("order_id"), "order_id missing from payment response"
        assert abs(pay["credit"] - task["final"]) < 0.01
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
        assert pay.get("seen_by_admin") is False

    # ---------- Admin new-order notifications ----------
    def test_34_admin_summary_reflects_new_orders(self, api, base_url):
        """GET /api/admin/summary -> new_orders count reflects unseen payments (>=2 from prev tests)."""
        r = api.get(f"{base_url}/admin/summary",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        j = r.json()
        assert "new_orders" in j, f"admin/summary missing 'new_orders' field: {j}"
        assert isinstance(j["new_orders"], int)
        assert j["new_orders"] >= 2, f"Expected >=2 new_orders (from tests 32/33), got {j['new_orders']}"
        self.state["new_orders_before_seen"] = j["new_orders"]

    def test_35_admin_notifications_seen_flips_flag(self, api, base_url):
        """POST /api/admin/notifications/seen -> new_orders becomes 0 afterward."""
        r = api.post(f"{base_url}/admin/notifications/seen", json={},
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        assert r.json().get("success") is True

        # Re-fetch summary — new_orders should now be 0
        r2 = api.get(f"{base_url}/admin/summary",
                     headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r2.status_code == 200
        assert r2.json()["new_orders"] == 0, f"After /notifications/seen, new_orders should be 0, got {r2.json()['new_orders']}"

    def test_36_admin_payments_screenshot_visible(self, api, base_url):
        r = api.get(f"{base_url}/admin/payments?status=pending",
                    headers={"Authorization": f"Bearer {self.state['admin_token']}"})
        assert r.status_code == 200
        pays = r.json()["payments"]
        found = next(p for p in pays if p["payment_id"] == self.state["pay_id"])
        assert found["screenshot"].startswith("data:image/")
        assert found["utr"] == "123456789012"
        # After test_35 (/notifications/seen) — flag flipped
        assert found.get("seen_by_admin") is True

    def test_37_admin_reject_does_not_credit(self, api, base_url):
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

    def test_38_admin_approve_credits_final_and_reward(self, api, base_url):
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
        task = self.state["task_l5"]
        # balance += final; total_earned += reward
        assert abs(u["balance"] - (bal_before + task["final"])) < 0.01, \
            f"balance mismatch: before={bal_before}, after={u['balance']}, expected +{task['final']}"
        assert abs(u["total_earned"] - (te_before + task["reward"])) < 0.01

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
                     json={"amount": 200, "account_id": self.state["acc_id"]},
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
        assert abs(r.json()["user"]["balance"] - (bal_before - 200)) < 0.01

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
        # Also assert 403 on notifications endpoints
        assert api.get(f"{base_url}/admin/summary", headers=h).status_code == 403
        assert api.post(f"{base_url}/admin/notifications/seen", json={}, headers=h).status_code == 403

    # ---------- Full e2e: login test1 -> pay L5 -> approve -> balance += final ----------
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
        task = self.state["task_l5"]

        big_ss = "data:image/jpeg;base64," + ("E" * 200)
        r = api.post(f"{base_url}/tasks/pay",
                     json={"task_id": task["task_id"],
                           "screenshot": big_ss, "utr": "123456789012",
                           "currency": "INR"},
                     headers=auth)
        assert r.status_code == 200, r.text
        pay = r.json()["payment"]
        pay_id = pay["payment_id"]
        assert pay.get("seen_by_admin") is False
        assert pay.get("order_id")

        r = api.post(f"{base_url}/admin/payments/{pay_id}/approve",
                     json={"note": "ok"}, headers=admin_h)
        assert r.status_code == 200

        r = api.get(f"{base_url}/auth/me", headers=auth)
        assert abs(r.json()["user"]["balance"] - (bal_before + task["final"])) < 0.01, \
            f"Expected balance +{task['final']}, before={bal_before}, after={r.json()['user']['balance']}"

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
