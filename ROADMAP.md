# Roadmap — truemail.io

This roadmap is written from a professional software-engineering perspective. It outlines product goals, milestones, implementation details, API contracts, testing strategy, security considerations, and a recommended timeline for delivering a production-ready email discovery and validation service.

Summary
- Product: truemail.io — find and verify email addresses (single & bulk), provide an API, dashboard, and subscription/credit model.
- Current state: Prototype with Express backend, file-based DB, simple auth (JWT), basic credit model, generator + verifier endpoints, and a basic demo UI. This roadmap guides turning the prototype into production.

Core features (MVP)
1. Authentication & Users
   - Email/password registration and login.
   - JWT issued on login, refresh token workflow.
   - Email verification flow (send confirmation email).
2. Credits & Billing
   - Credits model: each find/verify consumes credits.
   - Integration with a payment provider (Stripe) for one-time and recurring subscriptions.
   - Admin dashboard to issue credits and refunds.
3. Email Finding & Validation
   - Single and bulk finding (CSV upload API + UI).
   - Validation pipeline: syntax -> DNS MX -> SMTP probe -> mailbox verification heuristics.
   - Rate limiting, parallelization, and retry/backoff for network calls.
4. Developer API
   - Well documented REST endpoints with OpenAPI spec.
   - SDKs (Node, Python) for common workflows.
5. Dashboard & Team
   - Usage analytics, transaction history, team invites and role-based access.

Milestones & Timeline (suggested)
- Week 0: Planning & infra setup — repo, CI, issue tracker, staging environment.
- Week 1: Harden auth — add email verification, password reset, token refresh. Add unit tests for auth.
- Week 2: Billing integration — Stripe sandbox + webhook handling, subscription plans, add UI flows.
- Week 3: Bulk processing — background job queue (Bull/Redis), CSV upload, progress UI.
- Week 4: Validation improvements — robust MX/SMTP probing, parallel checks, caching MX results in Redis.
- Week 5: Security & infra — rate limiting, WAF rules, secrets management, HTTPS, monitoring.
- Week 6: SDKs & docs — OpenAPI generation, docs site, example apps.

Technical architecture
- Backend: Node.js + Express (current), consider migrating to TypeScript for better maintainability.
- Database: Postgres for users, credits, transactions; Redis for caching MX results and job queue.
- Queue: BullMQ (Redis) to process bulk lookups and retries.
- Storage: S3-compatible storage for uploaded CSVs and exports.
- Payments: Stripe (Subscriptions + one-time credit packs), webhooks to reconcile transactions.
- Deployment: Docker images, deployed to AWS ECS/Fargate or a managed platform. Use RDS for Postgres and ElastiCache for Redis.

API contract (important endpoints)
- POST /api/register {name,email,password} -> 201 { token, user }
- POST /api/login {email,password} -> 200 { token, user }
- POST /api/refresh-token { refreshToken } -> 200 { token, refreshToken }
- GET /api/me -> 200 { user }
- POST /api/generate { first?, last?, domain } -> 200 { emails[], cost, creditsRemaining }
- POST /api/verify { email, smtp? } -> 200 { formatValid, mxRecords, smtpConnect, cost, creditsRemaining }
- POST /api/bulk/find (multipart with CSV) -> 202 { jobId }
- GET /api/jobs/:id -> 200 { status, progress, resultUrl }

Security & privacy
- Always run behind HTTPS. Use HSTS and secure cookies for refresh tokens.
- Store passwords using bcrypt (cost factor >= 12) or Argon2 if available.
- Tokens: short-lived access tokens (~15m), rotating refresh tokens stored server-side.
- Rate limiting per IP and per API key to prevent abuse.
- Data retention policy: purge uploaded CSVs and results after configurable retention period.

Edge cases & failures
- MX/SMTP probes can be flaky: implement retries with exponential backoff and mark indeterminate results as "unknown".
- Bulk jobs should be resumable and support partial results.
- Handle transient DNS failures gracefully and cache negative responses for a short period.

Testing strategy
- Unit tests for generator, verifier, and auth logic.
- Integration tests for endpoints using an in-memory DB or test Postgres instance.
- End-to-end tests for UI flows (register, purchase credits, bulk upload) using Playwright.
- Load tests for bulk processing (k6 or Artillery) to validate scaling.

Observability & ops
- Logging: structured logs (JSON) with request IDs.
- Metrics: Prometheus/Grafana for request latency, error rates, credit consumption, job queue length.
- Alerts: SLO-based alerts (errors > 1% or latency P95 > threshold).

Deliverables & acceptance criteria
- Production-grade API with authentication, billing, robust verification pipeline, and a polished UI.
- Automated test coverage >= 70% for critical modules.
- Payment integration and live subscription plans.
- Documentation site with OpenAPI spec and SDK samples.

Next immediate steps (for this repo)
1. Replace file-based DB with Postgres (migrations + connection pooling).
2. Add Stripe sandbox integration and create webhooks endpoint to credit user accounts on successful payment.
3. Add Redis + BullMQ to offload bulk tasks and keep synchronous requests fast.
4. Start writing integration tests and a CI pipeline that runs lint/tests on PRs.

If you want, I can implement the first immediate step (migrate to Postgres) or set up Stripe sandbox integration next — tell me which one to prioritize and I will produce a detailed implementation plan and start making changes in this repo.
