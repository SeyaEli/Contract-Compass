export function validateCandles(rows, intervalMs) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 1500) throw new Error('The exchange returned incomplete candle data.');
  let previous = -Infinity;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 7) throw new Error('The exchange returned incomplete candle data.');
    const [start, open, high, low, close, volume, end] = row.slice(0, 7).map(Number);
    if (![start, open, high, low, close, volume, end].every(Number.isFinite) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start <= previous || end < start || low <= 0 || open < low || close < low || open > high || close > high || high < low || volume < 0 || (intervalMs && previous !== -Infinity && start - previous !== intervalMs)) throw new Error('The exchange returned inconsistent or missing candles. Refresh before using a setup.');
    previous = start;
  }
  return rows;
}
export function validateCosts(costs) {
  if (!costs || !Number.isFinite(costs.fee) || !Number.isFinite(costs.slip) || costs.fee < 0 || costs.fee > 1 || costs.slip < 0 || costs.slip > 5) throw new Error('Check cost assumptions: fee must be 0–1% and slippage 0–5% per side.');
  return costs;
}
