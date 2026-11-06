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


## Beginner-toggle release

VIEW-01 through VIEW-05 were observed failing before view-mode.js was implemented. They verify the default and saved preference, non-actionable WATCH explanations, long/short direction and risk language, unavailable states, and signal immutability. Final suite: 38 passing tests; core coverage 100% lines, 92.24% branches, 96.77% functions. Browser checks verified current-to-beginner switching, hidden technical sections, Show/Hide advanced details, persistence after reload, 18px reading text, no page overflow, and restoration of the current layout.

## Professional workspace release

The November 5, 2026 composition update retains the same six core modules and signal rules. All 38 tests and the 80% coverage gates pass: imported core coverage remains 100% lines, 92.24% branches, and 96.77% functions. This does not claim automated coverage of app.js or CSS.

Browser verification covered light/dark presentation, keyboard Space activation of Beginner view, saved view after reload, advanced-detail visibility, live SOLUSDT, BTCUSDT quick selection, explicit NOTACOIN rejection, recovery with a valid quick selection, and paused monitoring with reference-only plans. No browser console errors were observed in the checked session. At a 390px phone viewport, read-only DOM checks found no page overflow, six visible signal checks, and a 341px-wide chart with a matching viewBox and 14px chart labels. The responsive chart now fits its container rather than scrolling horizontally; below 500px it displays 30 recent candles, with the full history still used by the analysis engine. Desktop, phone, and tablet renders were captured for visual review.

The existing DESIGN.md remains the authority for the unchanged Graphite tokens and typography. WORKSPACE-UI.md records the confirmed composition and responsive behavior. The one manual Impeccable detector pass reported an aphoristic-copy warning; sidebar, method introduction, and footer copy were rewritten as direct descriptions.

The independent finish review requested two corrections: announce decision/connection changes accessibly, and put the phone decision before secondary statistics. A persistent polite status region now changes only when the decision/cause, contract/horizon, presentation, or connection changes; quote ages and price ticks are excluded. Browser verification of pause produced the explicit unavailable/reference-scenario announcement. At 390px, the compact price header preceded the decision (top 818px), which preceded market statistics (top 1106px), with no horizontal overflow. Native screen-reader speech was not separately tested. Content-hashed asset query strings prevent returning visitors from retaining old cached presentation code.

## Section navigation regression

Reproduced on the live Vercel app: selecting Position sizing changed the URL to `#risk-section` while the active menu item remained `#main`. Navigation now synchronizes its sole active item and `aria-current="location"` with the section hash. Browser checks verified all three destinations, keyboard Enter, back/forward, reload at `#methodology`, and Beginner navigation revealing advanced details. The theme button is outside the section-link selection. The existing 38-test suite and JavaScript syntax check pass; this small presentation fix has browser regression evidence rather than renderer unit coverage.
