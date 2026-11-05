import test from 'node:test';
import assert from 'node:assert/strict';
import { MarketMonitor, streamUrl, decodeMarketEvent } from '../dist/monitor.js';

test('MON-01: Subscription uses only the documented Binance endpoint and validated contracts',()=>{
  assert.equal(streamUrl('SOLUSDT','5m'),'wss://fstream.binance.com/market/stream?streams=solusdt@markPrice@1s/solusdt@kline_5m');
  assert.throws(()=>streamUrl('https://evil.example','5m'));assert.throws(()=>streamUrl('SOLUSDT','5m/evil'));
});
const mark=(patch={})=>JSON.stringify({stream:'solusdt@markPrice@1s',data:{e:'markPriceUpdate',s:'SOLUSDT',E:100000,p:'93.4',r:'0.0001',T:200000,...patch}});
test('MON-02: Reject malformed, wrong-symbol, delayed, future, or non-finite exchange events',()=>{
  assert.equal(decodeMarketEvent(mark(),'SOLUSDT','5m',100000).price,93.4);
  for(const body of ['bad',null,mark({s:'BTCUSDT'}),mark({p:'NaN'}),mark({p:'-1'}),mark({E:80000}),mark({E:120000}),mark({st:2})]) assert.equal(decodeMarketEvent(body,'SOLUSDT','5m',100000),null);
});
test('MON-03: Only closed candles notify the analysis refresh path',()=>{
  const frame=x=>JSON.stringify({data:{e:'kline',s:'SOLUSDT',E:100000,k:{s:'SOLUSDT',i:'5m',t:1,T:99999,x,o:'93',h:'94',l:'92',c:'93.4',v:'5'}}});
  assert.equal(decodeMarketEvent(frame(false),'SOLUSDT','5m',100000),null);
  assert.equal(decodeMarketEvent(frame(true),'SOLUSDT','5m',100000).kind,'candle');
});
function fixture(){
  let clock=100000,next=1;const jobs=new Map(),sockets=[],events=[],statuses=[];
  const m=new MarketMonitor({createSocket:url=>{const ws={url,close(){this.closed=true;},onopen:null,onmessage:null,onerror:null,onclose:null};sockets.push(ws);return ws;},now:()=>clock,serverNow:()=>clock,setTimer:(fn,ms)=>{const id=next++;jobs.set(id,{fn,ms});return id;},clearTimer:id=>jobs.delete(id),onEvent:e=>events.push(e),onStatus:s=>statuses.push(s)});
  return{m,jobs,sockets,events,statuses,advance(ms){clock+=ms;},runDelay(ms){const entry=[...jobs].find(([,v])=>v.ms===ms);assert.ok(entry,'timer exists: '+ms);jobs.delete(entry[0]);entry[1].fn();}};
}
test('MON-04: Connection is live only after a valid quote; duplicates do not update the quote',()=>{
  const f=fixture();f.m.start('SOLUSDT','5m');const ws=f.sockets[0];ws.onopen();assert.notEqual(f.statuses.at(-1),'live');
  ws.onmessage({data:mark()});ws.onmessage({data:mark()});assert.equal(f.events.length,1);assert.equal(f.statuses.at(-1),'live');f.m.stop();
});
test('MON-05: Reconnect backs off and canceled generations cannot update a new contract',()=>{
  const f=fixture();f.m.start('SOLUSDT','5m');const old=f.sockets[0];old.onclose();assert.equal(f.statuses.at(-1),'reconnecting');
  f.runDelay(1000);assert.equal(f.sockets.length,2);f.sockets[1].onclose();f.runDelay(2000);assert.equal(f.sockets.length,3);
  f.m.start('BTCUSDT','1m');old.onmessage({data:mark()});assert.equal(f.events.length,0);
  f.m.stop();assert.equal(f.jobs.size,0);assert.equal(f.statuses.at(-1),'paused');
});
test('MON-06: A silent socket expires and reconnects instead of preserving an active signal',()=>{
  const f=fixture();f.m.start('SOLUSDT','5m');f.sockets[0].onmessage({data:mark()});f.advance(16000);f.runDelay(5000);
  assert.equal(f.statuses.at(-1),'reconnecting');assert.equal(f.sockets[0].closed,true);f.m.stop();
});
test('MON-07: Socket constructor failure is contained and retried with backoff',()=>{
  const statuses=[];const m=new MarketMonitor({createSocket(){throw new Error('unavailable');},onStatus:s=>statuses.push(s),setTimer:()=>1,clearTimer(){}});
  m.start('SOLUSDT','5m');assert.equal(statuses.at(-1),'reconnecting');m.stop();
});
test('MON-08: The validated quote reaches consumers before the feed is declared live',()=>{
  let ws,delivered=false;
  const m=new MarketMonitor({createSocket:()=>ws={close(){}},serverNow:()=>100000,setTimer:()=>1,clearTimer(){},onEvent:()=>{delivered=true;},onStatus:s=>{if(s==='live')assert.equal(delivered,true);}});
  m.start('SOLUSDT','5m');ws.onmessage({data:mark()});m.stop();
});
test('MON-09: Host timers are invoked without the monitor as their receiver',()=>{
  const m=new MarketMonitor({createSocket:()=>({close(){}}),setTimer:function(){assert.equal(this,undefined);return 1;},clearTimer:function(){assert.equal(this,undefined);}});
  m.start('SOLUSDT','5m');m.stop();
});
