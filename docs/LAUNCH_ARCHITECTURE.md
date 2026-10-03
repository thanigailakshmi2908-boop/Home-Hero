# HomeHero launch architecture

Customer Web/PWA → HTTPS API → PostgreSQL/Redis → Dispatch/Payments/Notifications
Worker Web/PWA → HTTPS API → Matching/Jobs/Earnings
Admin → HTTPS API → Operations/Finance/Safety/AI

External adapters:
OTP/SMS | Maps | Payments/Payouts | KYC | Push | Telephony | AI

AI routing:
OpenRouter → Groq → Cloudflare Workers AI → local safe fallback.

For production:
- use HTTPS only
- keep all provider secrets server-side
- add rate limiting and abuse controls to OTP and AI endpoints
- use PostgreSQL + Redis rather than the beta JSON store
- add audit logs for admin actions
- add provider webhooks for payment and booking state changes
- add idempotency keys for payments and booking creation
- encrypt sensitive data and define retention/deletion policies
- use real routing data for ETA instead of straight-line estimates
- require human review for safety, financial and worker-verification decisions
