import test from 'node:test';
import assert from 'node:assert/strict';
import {sizePosition,analyze} from '../dist/engine.js';

test('SAFE-01: Position sizing rejects inverted stops, invalid prices, zero stop distance, and invalid minimums',()=>{
  const options={balance:1000,riskPct:1,leverage:2,fee:0,slip:0,step:.01};
  for(const plan of [{direction:'long',entry:100,stop:101,target2:104},{direction:'short',entry:100,stop:99,target2:96},{entry:0,stop:1,target2:2},{entry:100,stop:100,target2:104},{entry:NaN,stop:99,target2:104}])assert.throws(()=>sizePosition(plan,options));
  assert.throws(()=>sizePosition({entry:100,stop:99,target2:104},{...options,minQty:NaN}));
});
test('SAFE-02: Analysis rejects invalid cost assumptions and malformed candle arrays explicitly',()=>{
  const raw={serverTime:100000,markTime:100000,markPrice:100,tickSize:.01,entry:[],trend:[]};
  assert.throws(()=>analyze(raw,'1h',{fee:NaN,slip:0}),/cost/i);
  assert.throws(()=>analyze({...raw,entry:null}),'Incomplete input must be rejected.');
});
