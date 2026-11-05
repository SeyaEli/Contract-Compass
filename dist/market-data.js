import {HORIZONS,normalizeSymbol} from './engine.js';
import {validateCandles} from './validation.js';
export {validateCandles} from './validation.js';
const ORIGIN='https://fapi.binance.com';
const intervals={'1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
export function createMarketClient({fetchImpl=globalThis.fetch,now=Date.now}={}) {
  let cached=null, cachedAt=0, cooldownUntil=0;
  async function get(path,signal=new AbortController().signal) {
    if (now()<cooldownUntil) throw new Error('The exchange rate limit is active. Wait before trying again.');
    let response;
    try { response=await fetchImpl(ORIGIN+path,{credentials:'omit',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])}); }
    catch(e) { if(signal.aborted)throw e;throw new Error('Binance could not be reached. Check your connection and try again.'); }
    if(response.status===429||response.status===418) {const seconds=Number(response.headers.get('Retry-After'));cooldownUntil=now()+Math.max(60000,Math.min(900000,(Number.isFinite(seconds)?seconds:60)*1000));throw new Error('The exchange rate limit was reached. Automatic requests are cooling down.');}
    if(response.status===403||response.status===451)throw new Error('Binance market data is unavailable from this location.');
    if(!response.ok)throw new Error('The exchange could not return market data. Try again later.');
    try {const text=await response.text();if(text.length>4000000)throw new Error('too large');return JSON.parse(text);}
    catch {throw new Error('Binance returned an unreadable response. Try again shortly.');}
  }
  async function catalog(signal) {
    if(cached&&now()-cachedAt<3600000)return cached;
    const data=await get('/fapi/v1/exchangeInfo',signal);
    if(!Array.isArray(data.symbols))throw new Error('The exchange returned an incomplete contract catalog.');
    cached=data.symbols.filter(x=>x&&/^[A-Z0-9]{2,24}USDT$/.test(x.symbol)&&/^[A-Z0-9]{1,24}$/.test(x.baseAsset)&&x.contractType==='PERPETUAL'&&x.quoteAsset==='USDT'&&x.status==='TRADING'&&Array.isArray(x.filters));cachedAt=now();return cached;
  }
  async function snapshot(input,horizon,signal) {
    const symbol=normalizeSymbol(input), h=HORIZONS[horizon];
    if(!Object.hasOwn(HORIZONS,horizon))throw new Error('Choose a supported holding time.');
    const list=await catalog(signal), meta=list.find(x=>x.symbol===symbol);
    if(!meta)throw new Error(`${symbol} is not an active USDT perpetual contract. Try SOLUSDT, BTCUSDT, or ETHUSDT.`);
    const q=encodeURIComponent(symbol);
    const [clock,mark,ticker,entry,trend]=await Promise.all([get('/fapi/v1/time',signal),get('/fapi/v1/premiumIndex?symbol='+q,signal),get('/fapi/v1/ticker/24hr?symbol='+q,signal),get(`/fapi/v1/klines?symbol=${q}&interval=${h.entry}&limit=240`,signal),get(`/fapi/v1/klines?symbol=${q}&interval=${h.trend}&limit=240`,signal)]);
    validateCandles(entry,intervals[h.entry]);validateCandles(trend,intervals[h.trend]);
    if(mark.symbol!==symbol||ticker.symbol!==symbol||![clock.serverTime,mark.time,mark.markPrice,mark.lastFundingRate,mark.nextFundingTime,ticker.highPrice,ticker.lowPrice,ticker.quoteVolume,ticker.priceChangePercent].every(v=>v!==null&&v!==''&&Number.isFinite(Number(v)))||+mark.markPrice<=0||+ticker.lowPrice<=0||+ticker.highPrice<+ticker.lowPrice||+ticker.quoteVolume<0)throw new Error('The exchange returned inconsistent market data. Refresh before using a setup.');
    const filter=type=>meta.filters.find(x=>x.filterType===type);
    const tickSize=+filter('PRICE_FILTER')?.tickSize,step=+filter('LOT_SIZE')?.stepSize,minQty=+filter('LOT_SIZE')?.minQty,minNotional=+(filter('MIN_NOTIONAL')?.notional||0);
    if(![tickSize,step,minQty,minNotional].every(Number.isFinite)||tickSize<=0||step<=0||minQty<0||minNotional<0)throw new Error('The exchange returned invalid contract trading rules.');
    return {meta,catalog:list,raw:{symbol,entry,trend,serverTime:+clock.serverTime,markTime:+mark.time,markPrice:+mark.markPrice,tickSize,step,minQty,minNotional,ticker,funding:+mark.lastFundingRate,nextFunding:+mark.nextFundingTime}};
  }
  return {catalog,snapshot};
}
