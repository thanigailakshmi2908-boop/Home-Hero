# HomeHero integration status

## Implemented in this ZIP
- Phone + OTP authentication UI and backend
- Authenticated API token attached to protected requests
- Demo OTP and Twilio SMS adapter
- Service catalog and transparent quote
- Booking persistence
- Nearby worker matching using coordinates
- Booking dispatch refresh
- Booking cancellation
- Demo payment adapter
- Optional Razorpay live order + server-side signature verification adapter
- Browser notification permission + booking notifications
- External Maps handoff from booking tracking
- Customer service rating endpoint
- OTP expiry countdown in the UI
- Profile update
- Support ticket creation
- Worker application
- Admin summary
- AI chat with OpenRouter/Groq/Cloudflare failover and local fallback
- Premium responsive UI with 3D glow effects
- Loading states, toasts, validation and mobile navigation
- PWA manifest and GitHub Pages root structure

## Requires provider configuration for true external services
- Real SMS: Twilio credentials
- Real money movement: set PAYMENT_PROVIDER=razorpay and configure RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET; production marketplace payouts still require a payout/KYC design
- Production persistence: PostgreSQL/Redis recommended instead of JSON
- Production KYC: identity provider
- Production maps: geocoding/routing provider
- Production push notifications: push provider
- Telephony/chat: communications provider
- HTTPS domain, secrets manager, logging, monitoring and backups

The UI does not claim those external services are live when credentials are absent.
