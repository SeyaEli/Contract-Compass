// This is the only authority for the user-facing decision signal.
// Historical analysis alone is never sufficient to produce an active entry.
export function decisionSignal({analysis, price, quoteAt, analysisAt, now, connection, monitoring, visible, costsValid, refreshing=false, expectedClosedAt=0}) {
  const noSignal = reason => ({code:'NO_SIGNAL',title:'No live signal',actionable:false,tone:'wait',reason,next:'Restore fresh monitoring before using an entry signal.'});
  if (!analysis) return noSignal('Choose a contract and load a complete market analysis.');
  if (!costsValid) return noSignal('Enter valid fee and slippage assumptions.');
  if (refreshing) return noSignal('Updating the completed-candle confirmation.');
  if (analysis.closedAt < expectedClosedAt) return noSignal('Waiting for the newest completed candle to appear in the exchange history.');
  if (!monitoring) return noSignal('Monitoring is paused. The displayed plans are reference scenarios.');
  if (!visible) return noSignal('Monitoring is paused while this tab is hidden.');
  if (connection !== 'live') return noSignal('The live price feed is not connected. Reconnecting automatically when monitoring is enabled.');
  if (![price, quoteAt, analysisAt, now].every(Number.isFinite) || price <= 0 || now < quoteAt || now < analysisAt || now - quoteAt > 10000 || now - analysisAt > 90000 || analysis.stale) return noSignal('The price or candle analysis is stale. Waiting for fresh data.');
  const direction = analysis.signal;
  if (direction === 'long' || direction === 'short') {
    const p = analysis[direction], long = direction === 'long';
    const priceFits = p && p.valid && !p.blocked && !p.extended && p.crossed && (long ? price >= p.trigger && price > p.stop && price < p.target1 && price <= p.entry + analysis.atr * .8 : price <= p.trigger && price < p.stop && price > p.target1 && price >= p.entry - analysis.atr * .8);
    if (priceFits) return {code:long?'LONG':'SHORT',title:long?'Long signal':'Short signal',actionable:true,tone:direction,reason:analysis.reason,next:'All technical checks and the live price agree. Review the stop, costs, and position size before deciding.'};
    return {code:'WAIT',title:'Wait — entry no longer valid',actionable:false,tone:'wait',reason:'The live price has moved outside the confirmed entry conditions.',next:'Do not chase this move. Wait for a newly confirmed candle setup.'};
  }
  const bias=analysis.trendDirection;
  if (bias === 'up' || bias === 'down') return {code:bias==='up'?'WATCH_LONG':'WATCH_SHORT',title:bias==='up'?'Watch for a long':'Watch for a short',actionable:false,tone:'wait',reason:analysis.reason,next:'Watch means a directional bias only. It is not an entry signal.'};
  return {code:'WAIT',title:'Wait — no entry signal',actionable:false,tone:'wait',reason:analysis.reason,next:'The market checks do not agree. Wait for a confirmed long or short signal.'};
}
export function signalIdentity(symbol,horizon,code,closedAt) {
  return code==='LONG'||code==='SHORT' ? [symbol,horizon,code,closedAt].join(':') : null;
}
