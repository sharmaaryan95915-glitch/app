# Victory Pay — PRD

## Original Problem Statement
Convert the Victory Pay website (https://victory-pay-earning-platfroms-legall.lovable.app) into an Expo mobile app. A premium fintech rewards/earning wallet for Indian users (₹ INR).

## User Choices
- Auth: Email+password (JWT/session) AND Emergent Google login.
- Deposits: Manual UPI — now via TASK PAYMENT flow (QR + screenshot + admin approval).
- Admin panel: Yes.
- Design: Fresh mobile redesign — Luxe DARK glass theme (gold #D4AF37), Fraunces + Geist fonts.
- Reward on approval: user credited (amount + reward). Screenshot = declaration + admin manual review.

## Architecture
- Backend: FastAPI + MongoDB (motor). Unified session tokens in `user_sessions`. Collections: users, tasks, task_payments, plan_activations, transactions, withdraw_requests, payout_accounts, support_messages, app_config.
- Frontend: Expo Router (bottom tabs), reanimated animations, expo-blur glass, expo-image-picker, keyboard-controller.

## Implemented (2026-07-24)
- Premium animated intro on launch.
- Auth: register (₹70 bonus), login, Google, referral (₹300 to referrer).
- Home: balance card, LIVE payouts ticker, live platform stats (active earners / paid out / payouts today), quick actions, my stats, recent activity.
- Tasks tab: Premium Plans (₹1200→120, 1900→210, 2600→310, 3500→750 trending, 6500→900, 8500→1250) + Daily Tasks (₹500..2000 @4%), fancy codes on each.
- Payment screen: dual QR (PhonePe/GPay random), green profit pulse, UPI `harsh.g216@ptyes`, screenshot upload + real-time declaration, submit.
- Payout Accounts (PhonePe/GPay/Paytm/FamPay/Mobikwik/Bank), used in withdrawal.
- Withdraw: select payout account, admin-approved.
- Referrals: code share/copy, invited list.
- Help & Support: Telegram link, FAQ, in-app support chat (user↔admin).
- Admin panel: Payments (screenshot review + approve credits amount+reward), Withdrawals, Support threads (reply), Users.
- Verified: 32/32 backend tests + frontend flows.

## Test Credentials
- Admin: admin@victorypay.com / Admin@123
- User: test1@example.com / pass123

## Backlog / Next
- P1: Admin ability to edit QR/UPI config from app; push notifications (on request).
- P1: Task payment status screen for users (track pending/approved/rejected with reason).
- P2: Withdrawal min/limits config; KYC; anti-fraud on screenshots.
- P2: Migrate remaining pointerEvents to style (done for intro/toast/payment).
