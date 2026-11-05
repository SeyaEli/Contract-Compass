const ALLOWED_INTERVALS=new Set(['1m','5m','15m','1h']);
export function streamUrl(symbol,interval) {
  if(!/^[A-Z0-9]{2,24}USDT$/.test(symbol)||!ALLOWED_INTERVALS.has(interval))throw new Error('Unsupported live contract or candle interval.');
  const s=symbol.toLowerCase();
  return `wss://fstream.binance.com/market/stream?streams=${s}@markPrice@1s/${s}@kline_${interval}`;
}
export function decodeMarketEvent(text,symbol,interval,serverTime) {
  try {
    if(typeof text!=='string'||text.length>16000)return null;
    const outer=JSON.parse(text),d=outer.data||outer;
    if(!d||d.s!==symbol||(d.st!==undefined&&d.st!==1)||!Number.isSafeInteger(d.E)||!Number.isFinite(serverTime)||serverTime-d.E>10000||d.E-serverTime>5000)return null;
    if(d.e==='markPriceUpdate'&&Number.isFinite(+d.p)&&+d.p>0&&Number.isFinite(+d.r)&&Number.isSafeInteger(d.T))return {kind:'quote',price:+d.p,eventTime:d.E,funding:+d.r,nextFunding:d.T};
    if(d.e==='kline'&&d.k?.x===true&&d.k.s===symbol&&d.k.i===interval&&Number.isSafeInteger(d.k.T)&&d.k.T<d.E) {
      const k=d.k, values=[k.o,k.h,k.l,k.c,k.v].map(Number);
      if(!values.every(Number.isFinite)||+k.l<=0||+k.h<+k.l||+k.o<+k.l||+k.o>+k.h||+k.c<+k.l||+k.c>+k.h||+k.v<0)return null;
      return {kind:'candle',eventTime:d.E,closedAt:k.T};
    }
  } catch { /* Malformed exchange messages never reach analysis. */ }
  return null;
}
export class MarketMonitor {
  constructor({createSocket=url=>new WebSocket(url),now=Date.now,serverNow=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,onEvent=()=>{},onStatus=()=>{}}={}) {
    Object.assign(this,{createSocket,now,serverNow,onEvent,onStatus});this.setTimer=(fn,ms)=>setTimer(fn,ms);this.clearTimer=id=>clearTimer(id);this.generation=0;this.retry=null;this.watch=null;this.socket=null;
  }
  start(symbol,interval) {
    const url=streamUrl(symbol,interval);this.stop(false);this.enabled=true;this.symbol=symbol;this.interval=interval;this.url=url;this.attempt=0;this.lastQuote=-Infinity;this.lastCandle=-Infinity;this.lastAt=this.now();this.connect(this.generation);
  }
  status(value){if(this.state!==value){this.state=value;this.onStatus(value);}}
  connect(generation) {
    if(!this.enabled||generation!==this.generation)return;
    this.status(this.attempt?'reconnecting':'connecting');this.lastAt=this.now();
    try {this.socket=this.createSocket(this.url);} catch {this.reconnect(generation);return;}
    const ws=this.socket,active=()=>this.enabled&&generation===this.generation&&this.socket===ws;
    ws.onopen=()=>{if(active())this.status('connecting');};
    ws.onmessage=event=>{
      if(!active())return;
      const decoded=decodeMarketEvent(event.data,this.symbol,this.interval,this.serverNow());if(!decoded)return;
      if(decoded.kind==='quote') {
        if(decoded.eventTime<=this.lastQuote)return;this.lastQuote=decoded.eventTime;this.lastAt=this.now();this.attempt=0;
      }else{if(decoded.closedAt<=this.lastCandle)return;this.lastCandle=decoded.closedAt;}
      this.onEvent(decoded);
      if(decoded.kind==='quote')this.status('live');
    };
    ws.onerror=ws.onclose=()=>{if(active())this.reconnect(generation);};
    const check=()=>{if(!active())return;if(this.now()-this.lastAt>15000){this.reconnect(generation);return;}this.watch=this.setTimer(check,5000);};
    this.watch=this.setTimer(check,5000);
  }
  reconnect(generation) {
    if(!this.enabled||generation!==this.generation||this.retry!==null)return;
    this.clearTimer(this.watch);this.watch=null;
    const old=this.socket;this.socket=null;try{old?.close();}catch{}
    this.status('reconnecting');const delay=Math.min(30000,1000*2**Math.min(this.attempt++,5));
    this.retry=this.setTimer(()=>{this.retry=null;this.connect(generation);},delay);
  }
  stop(notify=true) {
    this.enabled=false;this.generation++;this.clearTimer(this.retry);this.clearTimer(this.watch);this.retry=null;this.watch=null;
    const old=this.socket;this.socket=null;try{old?.close();}catch{}
    if(notify)this.status('paused');
  }
}
