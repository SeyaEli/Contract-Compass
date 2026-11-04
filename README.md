# Contract Compass

A browser app for analyzing active Binance USDT perpetual contracts. Enter a symbol and holding horizon to view a chart, transparent long/short/wait assessment, two conditional scenarios, and cost-aware position sizing. SOLUSDT and a one-hour horizon are the defaults.

## Run locally

Serve `dist/` with any static HTTP server. For example, run `python -m http.server 8108 --directory dist`, then visit `http://localhost:8108`. ES modules require HTTP; opening index.html directly as a file is unsupported. No install, API key, or account connection is required.

## Checks

Run `node --test tests/engine.test.mjs`. The analysis is in `dist/engine.js`; market requests and rendering are in `dist/app.js`. Browser requests go directly to `https://fapi.binance.com`; availability depends on location and exchange access. No proxy or geographic bypass is provided.

## Limits

This is a technical heuristic, not a prediction model. No statistical accuracy, backtested returns, or guaranteed performance is claimed. It uses completed candles and explicitly expires old assessments. News, order book depth, portfolio exposure, liquidation prices, and account-specific leverage tiers are not modeled. Target levels are projections and may never be reached. Fees and slippage are editable assumptions; funding is shown separately and excluded from sizing. This app never places trades.
