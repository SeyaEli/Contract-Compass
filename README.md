# Contract Compass

A public browser app for active Binance USDT perpetual contracts. Version 2 adds readable type, one authoritative decision signal, live mark prices, and a session activity log.

## Which signal to use

Use the large **decision banner**, rather than a scenario card or a single indicator.

| Identifier | Meaning |
| --- | --- |
| LONG | The closed-candle long checks and current live price agree. Review risk before deciding. |
| SHORT | The closed-candle short checks and current live price agree. Review risk before deciding. |
| WATCH LONG / WATCH SHORT | Directional bias only. No confirmed entry. |
| WAIT | The checks disagree or the entry is no longer valid. |
| NO SIGNAL | Monitoring is paused, hidden, disconnected, updating, stale, or invalid. |

This is an unvalidated technical heuristic, not a prediction model. No statistical accuracy, backtested returns, or guaranteed performance is claimed. Targets may never be reached. News, depth, portfolio exposure, account leverage tiers, and liquidation prices are not modeled. Funding is separate and excluded from sizing.

## Run and test

Serve `dist/` with a static HTTP server: `python -m http.server 8108 --directory dist`, then visit `http://localhost:8108`. No install, API key, or exchange account connection is needed. ES modules require HTTP.

With Node.js 22 or newer, run `npm test` and `npm run test:coverage`. Coverage enforces 80% lines, branches, and functions for the imported core modules. Rendering and live user journeys have separate checks in [TESTS.md](TESTS.md); the core percentage is not a renderer coverage claim.

## Deploy on Vercel

Import this repository with the project Root Directory set to the repository root (leave it blank in Vercel). The committed `vercel.json` selects Other as the framework, skips dependency installation, runs the dependency-free `node scripts/build-site.mjs` to generate content and validated public settings, and serves `dist/` as the output directory. Push to the connected production branch to deploy. For local content/configuration edits, run `npm run build` before serving `dist/`.

If the homepage returns 404 but `/dist/index.html` loads, the repository root is being served instead of `dist/`. Deploy the commit containing `vercel.json`; the homepage and favicon must then load at `/` and `/favicon.ico`. Do not add a catch-all rewrite: the app uses query parameters and anchors, with no client-side path router. Missing assets should remain real 404 responses.

## Architecture and trust boundaries

The app remains static and public, with no application backend, order execution, exchange credentials, or database. Vercel serves the current GitHub deployment; the legacy Sites identity is retained in its separate hosting manifest. Calculator balances remain in page memory. The selected symbol, horizon, appearance, and optional measurement preference can be stored locally.

| Module | Responsibility |
| --- | --- |
| validation.js | Ordered candles, OHLC consistency, finite values, bounded costs. |
| market-data.js | Validated catalog and REST snapshots from a fixed HTTPS origin; timeout, cancellation, rate-limit cooldown. |
| engine.js | Pure completed-candle indicators, plans, cost-aware reward/risk, lot-rounded sizing. |
| monitor.js | One fixed-origin WebSocket; event validation, timestamp deduplication, reconnect, silent-socket expiry, generation isolation. |
| signal-state.js | Sole authority for an entry: freshness, visibility, costs, newest candle, current-price conditions. |
| app.js | Lifecycle and accessible rendering; price ticks cannot independently confirm a candle entry. |

The market client and monitor accept injected I/O and clocks. Analysis and decisions have no network or browser dependency. Presentation changes independently of the live quote and countdown.

## Monitoring contract

Binance's documented `/market/stream` route supplies a one-second mark-price stream and entry-interval candles. Actual delivery depends on the exchange and connection. REST analysis refreshes every 60 seconds and after a candle closes.

An entry requires a quote no older than 10 seconds and analysis no older than 90 seconds. A newly closed stream candle suppresses the old signal until REST confirms it. The current price must retain the breakout, remain before target 1 and on the valid side of the stop, and avoid excessive extension. Unfinished candles cannot create a signal.

Monitoring pauses when hidden or manually paused and refreshes before resuming. Silent sockets reconnect after 15 seconds; retry delays are 1, 2, 4, 8, 16, then at most 30 seconds. A contract change invalidates prior callbacks. In-page highlights are deduplicated by symbol/horizon/direction/candle. The bounded activity log stays in memory. There is no monitoring or notification service after the page closes.

## Security controls and limits

- Fixed HTTPS/WSS origins and validated active symbols; no arbitrary destinations or signed exchange requests.
- Quotes/candles validated before analysis; wrong-symbol, malformed, delayed, future, duplicate and out-of-order messages rejected.
- HTML Content Security Policy restricts scripts/styles to self and connections to the named market origins. Objects, frames, workers, form submissions and base URL injection are blocked. Referrer policy is no-referrer. Host headers and private access remain Sites responsibilities; a meta policy does not enforce frame-ancestors or replace host authorization.
- User-visible strings use text nodes or validated/escaped values. There are no inline script handlers, secrets, or production package dependencies. The shipped configuration loads no advertising or analytics provider code. Optional integrations are isolated in site.js and gated by validated configuration and privacy choices.
- Requests omit credentials. Rate limits and geographic restrictions are explicit errors; no geographic bypass is provided.
- Stop fills, interruptions, and liquidation can cause losses beyond the calculator estimate. No orders are placed.

## Release and recovery

The existing Site identity, public no-login audience, and static configuration are preserved. The previous saved version before the beginner toggle is version 3, source commit 7861b9bb43ea7b8fe687b0fb14c3ba39b1311770. No schema or user-data migration is involved. Contract, horizon, and theme preferences remain compatible. Packages are built from the exact pushed source commit. If startup, monitoring or private access fails after release, review restoring the previous saved version in Sites history. Do not widen the audience to resolve a failure.

## Optional beginner view

The Beginner view switch leaves the current layout as the default. Switching on adds larger 18px reading text, simple signal explanations, a getting-started guide, and a glossary. Technical sections are hidden until Show advanced details is selected. Switching off restores the current layout. The preference is stored locally as compass-view; invalid values fall back to current. This presentation layer does not modify signals, prices, calculations, or monitoring.

## Learning, privacy and future advertising

Public information and guide pages are generated from content/pages.mjs. The existing trading engine and monitoring are unchanged. A separate site.js handles optional services; failure there must not interrupt the workspace. User opt-in controls page measurement, and URL queries/fragments and calculator inputs are excluded. Live ads are disabled because the owner confirmed Vercel Hobby and no AdSense account. Read [MONETIZATION.md](MONETIZATION.md) for the real account, approval, commercial-hosting and consent-provider gates. No actual ad delivery or revenue is claimed.
