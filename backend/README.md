# DAHLEEZ Newsroom API

Cloudflare Workers + D1 newsroom backend for **دهليز | DAHLEEZ**.

## Live infrastructure
- Worker: `dahleez-newsroom`
- Public endpoint: https://dahleez-newsroom.dstwr.workers.dev
- D1 database: `dahleez-newsroom`
- Database schema: applied; tables `sources`, `stories`, and `audit_log` verified.
- Scheduled ingestion: every 15 minutes.
- Editor credential: `ADMIN_TOKEN` is stored as an encrypted Worker secret.
- Static site: served from `public/` by Workers Static Assets.
- Deployment: GitHub Actions on pushes to `main` that change `backend/**`, `public/**`, or the deployment workflow; manual dispatch remains available.

## API
- `GET /api/health`: service health.
- `GET /api/stories?limit=20`: approved stories only.
- `GET /api/admin/review`: pending stories; requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `POST /api/admin/decision`: approve or reject a pending story; requires the editor secret.

## Editorial safety
- New feed items are pending by default.
- Nothing is published automatically.
- RSS/Atom sources must be reviewed for authenticity and reuse terms before activation.
- Do not republish publisher summaries or media unless the applicable terms or permission allow it. Prefer original editorial summaries with clear source attribution and links.
- AI assistance may support research and drafting, but cannot establish truth or approve sensitive stories.

## Remaining launch requirements
1. Add approved official RSS/Atom feeds to `SOURCES_JSON` after their terms are reviewed.
2. Test feed ingestion and editor review with real items.
3. Configure a custom domain if desired.
4. Complete privacy/contact pages and mobile QA.
5. Approve any public launch explicitly.

## GitHub Actions secrets
The deployment workflow reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from repository Actions secrets. Never put their values in Git or chat.
