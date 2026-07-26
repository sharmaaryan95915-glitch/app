# Victory Pay — PRD

## Original Problem Statement
Convert the Victory Pay website into an Expo mobile app — a premium fintech rewards/earning wallet (₹ INR). Later fully redesigned to a LIGHT green fintech style (RynPay reference) with Buy RP / Sell RP levels.

## Architecture
- Backend: FastAPI + MongoDB (motor). Session tokens in `user_sessions`. Collections: users, tasks (L1–L7), task_payments, plan_activations, transactions, withdraw_requests, payout_accounts, support_messages, app_config.
- Frontend: Expo Router (floating light tab bar: Home / Buy RP / Sell RP / Mine), reanimated animations, expo-image-picker, keyboard-controller, CoinGecko live USDT rate.
- Theme: LIGHT — white cards, #F2F3F7 bg, green #0BA36B primary, blue accents, Geist font.

## Implemented (updated 2026-07-26)
- Premium intro animation (light/green).
- Auth: register (₹70 bonus), login, Google, referral (₹300).
- Home: green header + balance, Daily Rewards / USDT Top-up / Deposit USDT banners, stats card (Buy qty/amount, Sell today, Total revenue), Tutorial.
- Buy RP: L1–L7 level tabs, sort + refresh, order cards (Order amount, quantity, Reward + ₹10 bonus, Final RP, fancy code), Receive → payment.
- Payment: UPI/INR ↔ USDT toggle (live CoinGecko rate), large QR + Change-QR (2 QRs), Payment Information (Beneficiary=Harsh Gupta, method, UPI harsh.g216@ptyes / USDT address, Amount), mandatory UTR + screenshot, optional Remarks, red Warning box, "Order Confirmed" success animation.
- Sell RP: Today's Overview, Sell/Withdraw + Record, Wallet Information (empty state / list), Add Wallet, rules.
- Mine: profile header, invite code copy/share, Current Balance + Withdraw, My Team banner, menu (Newbie Rewards, Bind Payment, History, Common Problem, Online Service, Official Channel), Admin entry, logout.
- Payout accounts, withdraw (account-based, admin approved), support chat (user↔admin), admin panel (Payments w/ screenshot review crediting task.final, Withdrawals, Support, Users).
- On payment approval: balance += final (amount+reward+₹10), total_earned += reward.
- Verified: 33/33 backend + all frontend flows.

## Test Credentials
- Admin: admin@victorypay.com / Admin@123
- User: test1@example.com / pass123

## Update 2026-07-26 (payment polish)
- Real UPI `9905066606@ptyes` shown below QR (copyable); 4 QR codes auto-rotate randomly every 3 min + manual Change QR.
- Order ID auto-generated per payment (returned by /api/tasks/pay), shown in success overlay with double-tick professional confirmation.
- Help screen: prominent "Instant Help & Complaints" Telegram group (https://t.me/+fPoKJBDQY-9lMTZl) + Official Channel.

## Backlog / Next
- P1: Admin edit QR/UPI/USDT-address & beneficiary from app.
- P2: Level unlock progression, withdrawal limits/KYC.

## Update 2026-07-26 (iter 5 — onboarding, auto-approve, orders)
- First-time Onboarding overlay (4 steps) for new regular users, wired in _layout.tsx; persisted via storage key `onboarding_seen_<user_id>`.
- Hourly local invest-reminder notifications (expo-notifications) scheduled on startup — only testable on native APK/iOS build, no-op on web/Expo Go.
- Admin panel: new-order alert — bell badge + `new-orders-alert` banner driven by backend `seen_by_admin` flag (summary.new_orders; marked seen on load).
- Task tiers ₹500–₹20000 (L1–L7) + New User Special plans (level 0). Navi UPI payout added.
- QR auto-rotates every 2 min (no manual change button).
- Payments AUTO-APPROVE after 15 min: shared `_approve_payment()` + `auto_approve_due()`; background loop every 60s + lazy triggers on /auth/me, /tasks/my-payments, /admin/summary. No double-credit.
- New `/orders` (My Orders) screen: shows Order ID, amount, profit, wallet credit, UTR, date, status (Pending/Approved/Rejected). Success overlay routes here after payment.
- Verified: 39/39 backend pytest + frontend flows.
