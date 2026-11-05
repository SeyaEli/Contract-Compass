import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketClient, validateCandles} from '../dist/market-data.js';

const candle=[0,'93','94','92','93.4','100',299999];
test('DATA-01: Reject invalid OHLC, out-of-order or duplicate candles before calculating indicators',()=>{
  assert.doesNotThrow(()=>validateCandles([candle,[300000,'93','94','92','93','1',599999]]));
  for(const rows of [null,[],[null],[[0,'93','92','94','93','1',299999]],[[0,'95','94','92','93','1',299999]],[[0,'93','94','92','NaN','1',299999]],[candle,candle]])assert.throws(()=>validateCandles(rows));
});
test('DATA-02: REST requests use credential-free fixed-origin endpoints and respect cooldown after rate limits',async()=>{
  let calls=0,clock=1000;
  const client=createMarketClient({now:()=>clock,fetchImpl:async(url,init)=>{calls++;assert.ok(url.startsWith('https://fapi.binance.com/fapi/v1/'));assert.equal(init.credentials,'omit');return new Response('{}',{status:429,headers:{'Retry-After':'120'}});}});
  await assert.rejects(client.catalog(),/rate limit/i);await assert.rejects(client.catalog(),/rate limit/i);assert.equal(calls,1);
  clock+=121000;await assert.rejects(client.catalog(),/rate limit/i);assert.equal(calls,2);
});
test('DATA-03: Restricted regions, unreadable responses, network failures and aborted reads remain explicit errors',async()=>{
  for(const [status,body,pattern] of [[451,'{}',/location/i],[500,'{}',/exchange/i],[200,'not json',/unreadable/i],[200,'{}',/contract/i]]){
    const c=createMarketClient({fetchImpl:async()=>new Response(body,{status})});await assert.rejects(c.catalog(),pattern);
  }
  const c=createMarketClient({fetchImpl:async()=>{throw new Error('network');}});await assert.rejects(c.catalog(),/connection/i);
});
test('DATA-04: An injected symbol never reaches the network',async()=>{
  let calls=0;const c=createMarketClient({fetchImpl:async()=>{calls++;return new Response('{}');}});
  await assert.rejects(c.snapshot('SOLUSDT?token=secret','1h'),/contract/i);assert.equal(calls,0);
});
test('DATA-05: A valid snapshot integrates the catalog, quote, candle history and contract filters',async()=>{
  const calls=[];
  const symbol={symbol:'SOLUSDT',baseAsset:'SOL',quoteAsset:'USDT',contractType:'PERPETUAL',status:'TRADING',filters:[{filterType:'PRICE_FILTER',tickSize:'.01'},{filterType:'LOT_SIZE',stepSize:'.01',minQty:'.01'},{filterType:'MIN_NOTIONAL',notional:'5'}]};
  const bodies={'exchangeInfo':{symbols:[symbol]},'time':{serverTime:300001},'premiumIndex':{symbol:'SOLUSDT',time:300000,markPrice:'93.4',lastFundingRate:'.0001',nextFundingTime:999999},'ticker/24hr':{symbol:'SOLUSDT',highPrice:'94',lowPrice:'92',quoteVolume:'100000',priceChangePercent:'1'},'klines':[candle]};
  const c=createMarketClient({fetchImpl:async url=>{calls.push(url);const key=new URL(url).pathname.split('/fapi/v1/')[1];return Response.json(bodies[key]);}});
  const a=await c.snapshot('sol','1h');assert.equal(a.raw.symbol,'SOLUSDT');assert.equal(a.raw.step,.01);assert.equal(a.raw.minNotional,5);assert.equal(a.meta.baseAsset,'SOL');
  await c.catalog();assert.equal(calls.filter(x=>x.endsWith('exchangeInfo')).length,1);
  await assert.rejects(c.snapshot('UNKNOWNUSDT','1h'),/active/i);
});
test('DATA-06: Prototype keys are not supported holding horizons and cannot reach the exchange',async()=>{
  let calls=0;const c=createMarketClient({fetchImpl:async()=>{calls++;return Response.json({});}});
  await assert.rejects(c.snapshot('SOLUSDT','__proto__'),/holding/i);assert.equal(calls,0);
});
