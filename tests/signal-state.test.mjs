import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionSignal, signalIdentity } from '../dist/signal-state.js';

const now=100000;
function context(overrides={}) {
  const plan={entry:100,trigger:99.9,stop:99,target1:101.5,target2:102.5,valid:true,blocked:false,extended:false,crossed:true,rr:2};
  return {analysis:{signal:'long',trendDirection:'up',reason:'All checks align.',atr:1,closedAt:99999,long:plan,short:{...plan,entry:100,trigger:100.1,stop:101,target1:98.5,target2:97.5}},price:100,quoteAt:now-1000,analysisAt:now-1000,now,connection:'live',monitoring:true,visible:true,costsValid:true,...overrides};
}
test('SIG-01: Only the primary signal becomes LONG or SHORT when all checks and live price agree',()=>{
  assert.equal(decisionSignal(context()).code,'LONG');
  const c=context();c.analysis.signal='short';c.price=100;
  assert.equal(decisionSignal(c).code,'SHORT');
});
test('SIG-02: Stale quote, stale analysis, offline feed, hidden tab, pause, or bad costs suppress an entry',()=>{
  for(const patch of [{quoteAt:now-11000},{analysisAt:now-91000},{connection:'reconnecting'},{connection:'connecting'},{connection:'offline'},{visible:false},{monitoring:false},{costsValid:false},{quoteAt:now+1},{analysis:null},{refreshing:true},{expectedClosedAt:100001}]){
    assert.equal(decisionSignal(context(patch)).actionable,false,JSON.stringify(patch));
  }
});
test('SIG-03: A crossed stop, lost breakout, price at target, or overextended entry cannot stay LONG',()=>{
  for(const price of [98,99.8,100.81,101.5,102.5,NaN,0]) assert.equal(decisionSignal(context({price})).actionable,false,String(price));
});
test('SIG-04: WATCH means a directional bias only; mixed trend means WAIT',()=>{
  const c=context();c.analysis.signal='wait';
  assert.equal(decisionSignal(c).code,'WATCH_LONG');
  c.analysis.trendDirection='down';assert.equal(decisionSignal(c).code,'WATCH_SHORT');
  c.analysis.trendDirection='mixed';assert.equal(decisionSignal(c).code,'WAIT');
});
test('SIG-05: A changed symbol, horizon, direction or confirmed candle gets a distinct alert identity',()=>{
  const a=signalIdentity('SOLUSDT','1h','LONG',123);
  assert.notEqual(a,signalIdentity('BTCUSDT','1h','LONG',123));
  assert.notEqual(a,signalIdentity('SOLUSDT','4h','LONG',123));
  assert.notEqual(a,signalIdentity('SOLUSDT','1h','SHORT',123));
  assert.notEqual(a,signalIdentity('SOLUSDT','1h','LONG',124));
  assert.equal(signalIdentity('SOLUSDT','1h','WAIT',123),null);
});
