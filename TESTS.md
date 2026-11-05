# Verification record

The requested TDD-ECC workflow uses the existing native Node test runner. The ECC package-manager detector is not bundled with this skill or repository; package.json and node:test establish the runner. No production dependencies were added.

Tests were written and observed failing before implementation for signal lifecycle, external-data validation, monitor behavior and calculator guards. Additional RED/GREEN regressions address the browser host-timer binding error, quote-before-LIVE ordering, invalid prototype horizons and newest-candle consistency. The coverage command is npm run test:coverage.

| Requirement / risk | Evidence |
| --- | --- |
| One decision identifier; WATCH is not an entry | SIG-01, SIG-04, live banner check |
| Pause/hidden/stale/refresh/invalid costs/newest-candle gating | SIG-02, live pause/resume |
| Lost breakout, stop, target, extension remove entry | SIG-03 |
| Alert identity includes symbol, horizon, direction, candle | SIG-05 |
| Fixed-origin validated subscription | MON-01 |
| Invalid, wrong-symbol, stale/future messages rejected | MON-02 |
| Only closed candles trigger confirmation refresh | MON-03 and engine incomplete-candle regression |
| Valid quote before LIVE; duplicate filtering | MON-04, MON-08 |
| Reconnect/backoff/old-generation cleanup/silent expiry | MON-05, MON-06, MON-07 |
| Browser-safe host timers | MON-09 and live startup |
| Catalog, quote, candles and contract validation | DATA-01, DATA-03, DATA-05 |
| Credential-free reads and rate-limit cooldown | DATA-02 |
| Input and horizon injection rejected before requests | DATA-04, DATA-06 |
| Valid stops/targets/minima/costs and risk sizing | SAFE-01, SAFE-02 and original engine tests |
| Restricted executable code / outbound policy / no embedded credentials | SEC-01, SEC-02 |

## Live browser checks

Performed with connected-browser Playwright locators and read-only DOM checks:

- SOLUSDT: live mark-price feed, changing prices, quote age, and a conditional WATCH rather than a fabricated entry.
- Pause immediately shows NO SIGNAL and reference-only scenarios; resume reloads analysis and reconnects.
- Unknown contracts clear previous results and show a specific error. ETHUSDT quick selection recovers.
- ETHUSDT at 15 minutes uses 1m entry candles with the 15m trend filter.
- Editable costs recompute reward/risk and quantity. Affordability warnings appear. Defaults are valid.
- No page-level horizontal overflow at the preview width. The chart scrolls inside its container.
- Light/dark computed checks found no visible labels, body text, or chart text below 14px. Inputs are at least 16px. Screenshots inspected.

## Evidence limits

Automated coverage covers the imported core modules, not every app.js rendering path. Browser checks cover the primary live journeys. Profitability, uninterrupted 24-hour reliability, every exchange failure, and operating-system background scheduling are not validated. No win rate is claimed.

Final automated result: 33 passing tests; core coverage 100% lines, 91.95% branches, 96.67% functions. The 80% coverage gates pass. Invalid cost input was also verified in the browser to suppress the entry signal immediately.

