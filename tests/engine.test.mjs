import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSymbol,closeCandles,rsi,analyze,sizePosition,roundTick} from '../dist/engine.js';

function market(dir=1,breakout=true){
  const serverTime=1793808000000,span=300000;
  const rows=Array.from({length:120},(_,i)=>{
    const p=100+dir*i*.15;
    return [serverTime-(120-i)*span,p,p+.15,p-.15,p+dir*.05,1000,serverTime-(119-i)*span-1];
  });
  // A last closed candle with meaningful breakout participation; exclude a live candle.
  if(breakout){const p=+rows.at(-1)[4]+dir*.2;rows[119][2]=Math.max(+rows[119][2],p+.02);rows[119][3]=Math.min(+rows[119][3],p-.02);rows[119][4]=p;rows[119][5]=2000;}
  return {entry:rows,trend:rows,serverTime,markTime:serverTime-500,markPrice:+rows.at(-1)[4],tickSize:.01};
}
test('Accepts common contract formats and rejects injected or empty input',()=>{
  assert.equal(normalizeSymbol(' sol/usdt '),'SOLUSDT');assert.equal(normalizeSymbol('btc'),'BTCUSDT');assert.equal(normalizeSymbol('1000PEPEUSDT'),'1000PEPEUSDT');
  assert.throws(()=>normalizeSymbol('<script>'));assert.throws(()=>normalizeSymbol(''));
});
test('An unfinished candle cannot change closed-candle inputs',()=>{
  const r=market(), unfinished=[r.serverTime,1,9999,.01,9000,1e9,r.serverTime+299999];
  assert.deepEqual(closeCandles([...r.entry,unfinished],r.serverTime),closeCandles(r.entry,r.serverTime));
  assert.deepEqual(analyze({...r,entry:[...r.entry,unfinished]}).long,analyze(r).long);
});
test('Flat or extremely strong momentum does not imply a tradable signal',()=>{
  assert.equal(rsi(Array(40).fill(10)),50);assert.equal(rsi(Array.from({length:40},(_,i)=>i)),100);
  assert.equal(analyze(market(1)).signal,'wait');assert.equal(analyze(market(-1)).signal,'wait');
});
test('Both directions have correctly ordered levels and finite costs',()=>{
  const r=analyze(market());assert.ok(r.long.stop<r.long.entry&&r.long.target1>r.long.entry&&r.long.target2>r.long.target1);
  assert.ok(r.short.stop>r.short.entry&&r.short.target1<r.short.entry&&r.short.target2<r.short.target1);
  assert.ok(Number.isFinite(r.long.rr)&&Number.isFinite(r.short.rr));
});
test('Missing quotes, short history, stale feed and prohibitive costs cannot give a directional entry',()=>{
  const r=market();assert.throws(()=>analyze({...r,markPrice:NaN}));assert.throws(()=>analyze({...r,entry:r.entry.slice(-20)}));
  assert.equal(analyze({...r,markTime:r.serverTime-180000}).signal,'wait');
  assert.equal(analyze(r,'1h',{fee:1,slip:1}).long.valid,false);
});
test('Rounding quantity never exceeds the selected loss budget, including fees',()=>{
  const p={entry:93,stop:92,target2:96};
  for(const step of [.01,.1,1,10]){
    const s=sizePosition(p,{balance:1000,riskPct:.5,leverage:2,fee:.05,slip:.02,step});
    assert.ok(s.estimatedLoss<=5+1e-8);assert.ok(s.qty>=0);assert.ok(Math.abs(s.qty/step-Math.round(s.qty/step))<1e-8);
  }
});
test('Leverage changes margin, not quantity or stop-loss risk',()=>{
  const p={entry:93,stop:92,target2:96}, opts={balance:1000,riskPct:.5,fee:.05,slip:.02,step:.01};
  const a=sizePosition(p,{...opts,leverage:2}),b=sizePosition(p,{...opts,leverage:10});
  assert.equal(a.qty,b.qty);assert.equal(a.estimatedLoss,b.estimatedLoss);assert.equal(a.margin/5,b.margin);
});
test('Unaffordable margin and exchange minimums are surfaced',()=>{
  const p={entry:100,stop:99.9,target2:101};
  const s=sizePosition(p,{balance:100,riskPct:5,leverage:1,fee:0,slip:0,step:.01,minNotional:1e9});
  assert.equal(s.affordable,false);assert.equal(s.meetsMinimum,false);
  assert.throws(()=>sizePosition(p,{balance:0,riskPct:.5,leverage:2,fee:.05,slip:.02}));
  assert.equal(roundTick(.123456,.00001,'down'),.12345);
});
function confirmedMarket(dir=1){
  const t=1793808000000;
  const base=Array.from({length:120},(_,i)=>{const p=100+i*.015+Math.sin(i*.6)*.4;return[t-(120-i)*300000,p,p+.1,p-.1,p,1000,t-(119-i)*300000-1]});
  base.at(-1)[4]=102.4;base.at(-1)[2]=102.5;base.at(-1)[5]=2000;
  const tr=base.map((r,i)=>[r[0],100+i*.08,100+i*.08+.1,100+i*.08-.1,100+i*.08,1000,r[6]]);
  const mirror=rows=>rows.map(r=>[r[0],200-r[1],200-r[3],200-r[2],200-r[4],r[5],r[6]]);
  return{entry:dir===1?base:mirror(base),trend:dir===1?tr:mirror(tr),serverTime:t,markTime:t,markPrice:dir===1?102.4:97.6,tickSize:.01};
}
test('A supported breakout can produce either direction; lost price or volume confirmation removes it',()=>{
  const costs={fee:.01,slip:.01};
  for(const [dir,label] of [[1,'long'],[-1,'short']]){
    const r=confirmedMarket(dir);assert.equal(analyze(r,'1h',costs).signal,label);
    assert.equal(analyze({...r,markPrice:r.markPrice-dir*.5},'1h',costs).signal,'wait');
    const lowVolume=structuredClone(r);lowVolume.entry.at(-1)[5]=100;
    assert.equal(analyze(lowVolume,'1h',costs).signal,'wait');
    assert.equal(analyze({...r,markTime:r.serverTime-180000},'1h',costs).signal,'wait');
  }
});
