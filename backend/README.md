# DAHLEEZ Newsroom API

Starter backend for Cloudflare Workers + D1. The D1 database has been provisioned and its schema applied. The Worker itself is not deployed yet.

## What it does
- Scheduled RSS/Atom polling every 15 minutes.
- Deduplicates items by source and source item identifier.
- Stores all new items as **pending**. Nothing is published automatically.
- Exposes approved stories at `GET /api/stories`.
- Protects review endpoints with `ADMIN_TOKEN`.
- Records editor decisions in `audit_log`.

## Required setup (not performed)
1. Create a Cloudflare D1 database named `dahlez-newsroom`.
2. Replace the placeholder `database_id` in `wrangler.toml`.
3. Apply schema: `wrangler d1 execute dahlez-newsroom --file=schema.sql`.
4. Configure `ADMIN_TOKEN` as a Worker secret, never in Git.
5. Set `SOURCES_JSON` with a reviewed list of official RSS/Atom feeds and their permitted use.
6. Deploy the Worker and test health, ingestion, review, and approval.

Example source configuration:
`[{"id":"publisher-id","name":"Publisher name","feed_url":"https://publisher.example/feed.xml","category":"world","enabled":true}]`

Only use real feed URLs confirmed from the publisher's official site and check its reuse terms. The example domain is deliberately non-operational.

## Important limits
- RSS feeds are not proof that a claim is true.
- Ingestion does not rewrite, translate, summarize, or publish stories.
- Review and approval are explicit editorial steps.
- Feed availability, rate limits, D1 limits, and Worker free-plan quotas apply.
- Do not expose `ADMIN_TOKEN` in browser code.
