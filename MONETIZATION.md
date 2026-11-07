# Advertising launch checklist

This release prepares the website. It does not create an AdSense account, buy a hosting plan, obtain Google approval, manufacture traffic, or start earning revenue.

Owner-confirmed state on November 6, 2026: **Vercel Hobby; no AdSense account**. Live ads remain off.

## Shipped

- Public About, Contact and Privacy pages, a learning index, and four original guides.
- Canonical URLs, sitemap and robots.txt; current production origin in site-settings.json.
- Privacy choices on every page. Optional Vercel page measurement requires visitor opt-in; GPC/DNT suppress it. Only known paths are allowed, without query strings, fragments, custom events or calculator values.
- Validated off/review/live ad settings. No seller ID is published until the owner supplies a real one.
- A hidden manual ad placement below the calculator. No price-driven refresh, overlays, popups or forced ad clicks.
- Certified-CMP integration hooks, consent gating, revocation handling and privacy links. The site’s own dialog is not a certified CMP.
- No runtime package dependency, exchange credential, or changes to the signal engine.

## Owner account steps

1. **Enable traffic measurement.** In the existing Vercel project, open Analytics → Enable Web Analytics. Then set analytics to true in site-settings.json, build and redeploy. Visit the site, opt in through Privacy choices, and confirm real visits in the dashboard. Until these steps are completed, the integration stays inactive; no synthetic counts are displayed. The legacy /_vercel/insights/script.js route is supported by Vercel; confirm it returns JavaScript on the enabled deployment.
2. **Create AdSense yourself:** https://www.google.com/adsense/start/. The account owner must meet Google’s eligibility requirements and complete the applicable country, identity, payment and agreement steps. These are not software changes or guaranteed approvals.
3. **Add the exact site URL** in AdSense → Sites. If you choose a custom domain, configure it first and update site-settings.json’s origin before building; do not invent domain ownership.
4. **Supply your real public publisher ID.** Set ads.mode to review and ads.publisherId to your pub-… value. Run npm run build and deploy. The build generates the verification meta tag and the matching ads.txt line. Review mode never loads ad or advertising-consent scripts. Select the matching verification method in AdSense and request review.
5. **Wait for Google’s Ready/approved status.** The application’s financial content, site ownership and publisher policy eligibility must be reviewed by the network. These pages do not guarantee acceptance.
6. **Arrange commercial hosting before live ads.** Vercel Hobby prohibits commercial advertising. Upgrade only after reviewing the price yourself, or move to hosting that permits monetization. Set ads.commercialHosting to true only after completing that change. A boolean in a file does not upgrade your plan.
7. **Configure consent and the unit.** Publish Google’s certified Privacy & Messaging consent message, verify its actual CMP ID, and create one responsive manual display unit. Configure the message for your real traffic and required privacy frameworks; no self-authored dialog is substituted for it. Set the real 10-digit slotId and certifiedCmpId. Check the provider message, refusal, privacy-signal behavior and any CSP errors on the actual account integration before launch. Never broadly disable CSP to make a vendor work.
8. **Activate after those checks.** Set ads.siteApproved to true and ads.mode to live, run npm run build, test, commit, and deploy. Live configuration fails validation if required confirmations or identifiers are missing. Unknown consent keeps ads hidden. Review actual behavior on the approved account: a placeholder/test ID is not an integration test.

## Public configuration

site-settings.json contains public identifiers and operator confirmations, never a Google password, API key, bank account or token. The build writes its validated subset to dist/monetization.json. Edit the source settings, not generated dist files. Ads mode off generates only an ads.txt comment; review generates the real authorized-seller line; live additionally permits the explicitly listed Google service origins in CSP. Returning to off removes those permissions and ownership metadata on the next build.

Do not enable Google Auto ads in addition to this manual placement if you want to retain the one-unit layout. An ad blocked by a browser or missing consent should leave the workspace usable, without a fake ad or a demand to disable the blocker. Observe actual revenue in AdSense; the app does not claim estimated earnings.

The initial consent adapter supports TCF-covered visits only. `gdprApplies: false` is not permission to bypass other regional rules: those visits remain ad-free until the operator integrates and verifies the applicable regional consent adapter (for example, GPP). Loss of authorization after an ad starts removes its content and reloads the document, including unknown/error/pending CMP states, to stop previously loaded advertising. This deliberately favors withholding an ad over guessing consent.

## Before launch verification

Run npm run build, npm test and npm run test:coverage. Verify every sitemap URL and /ads.txt on the deployed origin. With ads off, no advertising or CMP scripts should load. Before analytics opt-in, no measurement script should load. Withdrawing permission must stop future collection; it does not erase previously received provider data. Real ad delivery, consent-provider certification and payment eligibility require the owner’s account and cannot be certified by unit tests.

Sources: [AdSense eligibility](https://support.google.com/adsense/answer/9724?hl=en), [site verification](https://support.google.com/adsense/answer/12169212?hl=en), [ads.txt](https://support.google.com/adsense/answer/12171612?hl=en), [certified CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en), [Google Privacy & Messaging API](https://developers.google.com/funding-choices/fc-api-docs), [Vercel analytics](https://vercel.com/docs/analytics/quickstart), [Vercel commercial-use rules](https://vercel.com/docs/limits/fair-use-guidelines).
