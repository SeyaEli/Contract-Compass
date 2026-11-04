export const HORIZONS = {
  '15m': { label: '15 minutes', entry: '1m', trend: '15m', ms: 900000 },
  '1h': { label: '1 hour', entry: '5m', trend: '1h', ms: 3600000 },
  '4h': { label: '4 hours', entry: '15m', trend: '4h', ms: 14400000 },
  '1d': { label: '1 day', entry: '1h', trend: '1d', ms: 86400000 }
};
export function normalizeSymbol(input) {
  let s = String(input).trim().toUpperCase().replace(/[\s/_-]/g, '');
  if (!/^[A-Z0-9]{2,24}$/.test(s)) throw new Error('Enter a contract such as SOLUSDT, BTCUSDT, or ETHUSDT.');
  if (!s.endsWith('USDT')) s += 'USDT';
  return s;
}
export const closeCandles = (rows, serverTime) => rows.filter(r => Number(r[6]) < serverTime).map(r => ({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],end:+r[6]}));
export function ema(values, n) {
  let v = values[0];
  return values.map((x,i) => i ? (v += (x-v)*2/(n+1)) : v);
}
export function rsi(values, n=14) {
  if(values.length <= n) return 50;
  let g=0,l=0;
  for(let i=1;i<=n;i++){g+=Math.max(values[i]-values[i-1],0);l+=Math.max(values[i-1]-values[i],0);}
  g/=n;l/=n;
  for(let i=n+1;i<values.length;i++){g=(g*(n-1)+Math.max(values[i]-values[i-1],0))/n;l=(l*(n-1)+Math.max(values[i-1]-values[i],0))/n;}
  return !g&&!l?50:!l?100:100-100/(1+g/l);
}
export function atr(c, n=14) {
  const tr=c.slice(1).map((x,i)=>Math.max(x.high-x.low,Math.abs(x.high-c[i].close),Math.abs(x.low-c[i].close)));
  let a=tr.slice(0,n).reduce((x,y)=>x+y,0)/n;
  for(const t of tr.slice(n))a=(a*(n-1)+t)/n;
  return a;
}
export function roundTick(value, tick, direction='nearest') {
  const method=direction==='up'?Math.ceil:direction==='down'?Math.floor:Math.round;
  return Number((method(value/tick+ (direction==='down'?1e-9:direction==='up'?-1e-9:0))*tick).toPrecision(12));
}
export function netRR(plan, fee=.05, slip=.02) {
  const rate=(fee+slip)/100;
  const risk=Math.abs(plan.entry-plan.stop)+(plan.entry+plan.stop)*rate;
  const reward=Math.abs(plan.target2-plan.entry)-(plan.entry+plan.target2)*rate;
  return reward/risk;
}
export function sizePosition(plan, {balance,riskPct,leverage,fee,slip,step=.01,minQty=0,minNotional=0}) {
  const values=[balance,riskPct,leverage,fee,slip,step];
  if(values.some(v=>!Number.isFinite(v))||balance<=0||riskPct<=0||riskPct>100||leverage<1||leverage>125||fee<0||slip<0||step<=0)throw new Error('Use a positive balance, risk from 0.01–100%, leverage from 1–125×, and nonnegative costs.');
  const budget=balance*riskPct/100;
  const perUnit=Math.abs(plan.entry-plan.stop)+(plan.entry+plan.stop)*(fee+slip)/100;
  const qty=roundTick(budget/perUnit,step,'down');
  const notional=qty*plan.entry;
  const margin=notional/leverage;
  const openingCost=notional*(fee+slip)/100;
  return {qty,notional,margin,budget,estimatedLoss:qty*perUnit,openingCost,affordable:margin+openingCost<=balance,meetsMinimum:qty>=minQty&&notional>=minNotional&&qty>0};
}
export function analyze(raw, horizon='1h', costs={fee:.05,slip:.02}) {
  if(!HORIZONS[horizon])throw new Error('Choose a supported holding time.');
  if(!Number.isFinite(raw.tickSize)||raw.tickSize<=0||!Number.isFinite(raw.markPrice)||raw.markPrice<=0||!Number.isFinite(raw.serverTime)||!Number.isFinite(raw.markTime))throw new Error('The exchange returned an incomplete quote. Refresh before using a setup.');
  const candles=closeCandles(raw.entry,raw.serverTime), trend=closeCandles(raw.trend,raw.serverTime);
  if(candles.length<60||trend.length<60)throw new Error('This contract has too little closed-candle history. Try an established contract or a shorter holding time.');
  if([...candles,...trend].some(x=>[x.open,x.high,x.low,x.close,x.volume].some(v=>!Number.isFinite(v))||x.low<=0||x.high<x.low||x.volume<0))throw new Error('The exchange returned incomplete candle data. Refresh before using a setup.');
  const last=candles.at(-1), prices=candles.map(x=>x.close), tp=trend.map(x=>x.close);
  const e20=ema(prices,20), te20=ema(tp,20), te50=ema(tp,50), a=atr(candles), momentum=rsi(prices);
  if(!(a>0))throw new Error('There is insufficient price movement to calculate a setup.');
  const range=candles.slice(-21,-1), support=Math.min(...range.map(x=>x.low)),resistance=Math.max(...range.map(x=>x.high));
  const avgVol=range.reduce((s,x)=>s+x.volume,0)/range.length, volumeRatio=avgVol?last.volume/avgVol:0;
  const up=tp.at(-1)>te20.at(-1)&&te20.at(-1)>te50.at(-1)&&te20.at(-1)>te20.at(-4);
  const down=tp.at(-1)<te20.at(-1)&&te20.at(-1)<te50.at(-1)&&te20.at(-1)<te20.at(-4);
  const tick=raw.tickSize, buffer=Math.max(a*.12,tick*2);
  const longTrigger=roundTick(resistance+buffer,tick,'up'), shortTrigger=roundTick(support-buffer,tick,'down');
  function plan(dir) {
    const sign=dir==='long'?1:-1, trigger=dir==='long'?longTrigger:shortTrigger;
    const crossed=dir==='long'?last.close>=trigger:last.close<=trigger;
    const entry=roundTick(crossed?last.close:trigger,tick);
    const stop=roundTick(entry-sign*a*1.2,tick,dir==='long'?'down':'up');
    const risk=Math.abs(entry-stop);
    const p={direction:dir,trigger,entry,stop,target1:roundTick(entry+sign*risk*1.5,tick),target2:roundTick(entry+sign*risk*2.5,tick),crossed};
    p.rr=netRR(p,costs.fee,costs.slip);
    const pivots=candles.slice(-100,-2).filter((x,i,arr)=>i>1&&i<arr.length-2&&(dir==='long'?x.high>arr[i-1].high&&x.high>arr[i+1].high:x.low<arr[i-1].low&&x.low<arr[i+1].low)).map(x=>dir==='long'?x.high:x.low).filter(v=>dir==='long'?v>entry+buffer:v<entry-buffer);
    p.obstacle=pivots.length?(dir==='long'?Math.min(...pivots):Math.max(...pivots)):null;
    p.blocked=p.obstacle!==null&&Math.abs(p.obstacle-entry)<risk*1.5;
    p.extended=crossed&&Math.abs(last.close-trigger)>a*.8;
    p.valid=p.stop>0&&p.target1>0&&p.target2>0&&p.rr>=1.5;
    return p;
  }
  const long=plan('long'),short=plan('short');
  const stale=raw.serverTime-Number(raw.markTime)>120000 || Number(raw.markTime)>raw.serverTime+10000 || raw.serverTime-last.end>({ '1m':60000,'5m':300000,'15m':900000,'1h':3600000 }[HORIZONS[horizon].entry]||3600000)*1.5;
  let signal='wait',reason='Price has not confirmed a breakout with aligned trend, momentum, and volume.';
  const enoughVol=volumeRatio>=1.2;
  if(long.crossed&&up&&momentum>=55&&momentum<=75&&enoughVol&&long.valid&&!long.blocked&&!long.extended){signal='long';reason='A closed candle broke resistance with an upward higher-timeframe trend and above-average volume.';}
  if(short.crossed&&down&&momentum>=25&&momentum<=45&&enoughVol&&short.valid&&!short.blocked&&!short.extended){signal='short';reason='A closed candle broke support with a downward higher-timeframe trend and above-average volume.';}
  if(stale){signal='wait';reason='The exchange snapshot is stale. Refresh before considering a setup.';}
  else if((signal==='long'&&(raw.markPrice<long.trigger||raw.markPrice>long.entry+a*.8))||(signal==='short'&&(raw.markPrice>short.trigger||raw.markPrice<short.entry-a*.8))){signal='wait';reason='The current mark price no longer offers the closed-candle setup. Wait for a fresh confirmation.';}
  else if(!up&&!down)reason='The higher-timeframe trend is mixed. Wait for clearer direction.';
  else if((long.crossed||short.crossed)&&!enoughVol)reason='Price crossed a level, but closed-candle volume did not confirm the move.';
  else if((long.crossed&&long.extended)||(short.crossed&&short.extended))reason='The breakout has already moved too far from its trigger. Wait for a fresh setup.';
  return {signal,reason,stale,candles,trend,e20,atr:a,rsi:momentum,volumeRatio,support,resistance,long,short,trendDirection:up?'up':down?'down':'mixed',trendEma20:te20.at(-1),trendEma50:te50.at(-1),closedAt:last.end,serverTime:raw.serverTime,horizon,raw};
}
