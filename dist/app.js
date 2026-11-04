import {HORIZONS,normalizeSymbol,analyze,sizePosition} from './engine.js';

const $=id=>document.getElementById(id), API='https://fapi.binance.com';
let raw=null, result=null, meta=null, catalog=null, catalogAt=0, controller=null, requestId=0, fetchedAt=0, activeSymbol='', activeHorizon='1h';
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cost=()=>({fee:+$('fee').value,slip:+$('slip').value});
function dp(){return Math.min(8,Math.max(2,Math.ceil(-Math.log10(raw?.tickSize||.01))));}
function price(v){return Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:dp(),maximumFractionDigits:dp()}):'—';}
function time(v,withDate=false){return new Intl.DateTimeFormat(undefined,{...(withDate?{month:'short',day:'numeric'}:{}),hour:'2-digit',minute:'2-digit',second:withDate?'2-digit':undefined,timeZoneName:withDate?'short':undefined}).format(v);}
function save(key,value){try{localStorage.setItem(key,value);}catch{}}
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function setBusy(b){$('analyze').disabled=b;$('analyze').setAttribute('aria-busy',String(b));$('analyze').textContent=b?'Analyzing…':'Analyze contract ↗';$('cancel').hidden=!b;$('loading').hidden=!b;$('refresh').disabled=b;}
function invalidate(){raw=null;result=null;$('results').hidden=true;$('empty').hidden=false;$('error').hidden=true;}
function showError(message){$('error').replaceChildren();const strong=document.createElement('strong');strong.textContent='Analysis unavailable';const p=document.createElement('p');p.textContent=message;const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.addEventListener('click',()=>load());$('error').append(strong,p,retry);$('error').hidden=false;}
async function api(path,signal){
  let response;
  try{response=await fetch(API+path,{signal:AbortSignal.any([signal,AbortSignal.timeout(18000)]),cache:'no-store',credentials:'omit'});}catch(e){if(signal.aborted)throw e;throw new Error('Binance market data could not be reached. Check your connection or try again later. Availability depends on your location and the exchange.');}
  let body;try{body=await response.json();}catch{throw new Error('Binance returned an unreadable response. Try again shortly.');}
  if(!response.ok){if(response.status===429||response.status===418)throw new Error('The exchange rate limit was reached. Pause automatic refresh and try again in a few minutes.');if(response.status===451||response.status===403)throw new Error('Binance market data is unavailable from this location. This app cannot provide a live assessment here.');throw new Error('The exchange could not return this contract’s market data. Check the symbol or try another contract.');}
  return body;
}
async function load(){
  const id=++requestId;controller?.abort();controller=new AbortController();const signal=controller.signal;
  let symbol;try{symbol=normalizeSymbol($('contract').value);}catch(e){invalidate();showError(e.message);setBusy(false);return;}
  const horizon=$('horizon').value, intervals=HORIZONS[horizon];
  invalidate();$('empty').hidden=true;setBusy(true);$('loading-detail').textContent='Fetching contract details and completed candles…';
  try{
    if(!catalog||Date.now()-catalogAt>3600000){
      const info=await api('/fapi/v1/exchangeInfo',signal);catalog=info.symbols.filter(x=>x.contractType==='PERPETUAL'&&x.quoteAsset==='USDT'&&x.status==='TRADING');catalogAt=Date.now();
      $('contracts').replaceChildren(...catalog.map(x=>{const o=document.createElement('option');o.value=x.symbol;return o;}));
    }
    const contract=catalog.find(x=>x.symbol===symbol);
    if(!contract)throw new Error(`${symbol} is not an active Binance USDT perpetual contract. Try SOLUSDT, BTCUSDT, ETHUSDT, or choose a contract from the suggestions.`);
    $('loading-detail').textContent=`Reading ${intervals.entry} entry candles and the ${intervals.trend} trend…`;
    const [clock,mark,ticker,entry,trend]=await Promise.all([
      api('/fapi/v1/time',signal),api('/fapi/v1/premiumIndex?symbol='+symbol,signal),api('/fapi/v1/ticker/24hr?symbol='+symbol,signal),
      api(`/fapi/v1/klines?symbol=${symbol}&interval=${intervals.entry}&limit=240`,signal),api(`/fapi/v1/klines?symbol=${symbol}&interval=${intervals.trend}&limit=240`,signal)
    ]);
    if(id!==requestId)return;
    meta=contract;const filter=t=>contract.filters.find(x=>x.filterType===t);
    raw={entry,trend,serverTime:+clock.serverTime,markTime:+mark.time,markPrice:+mark.markPrice,tickSize:+filter('PRICE_FILTER').tickSize,step:+filter('LOT_SIZE').stepSize,minQty:+filter('LOT_SIZE').minQty,minNotional:+(filter('MIN_NOTIONAL')?.notional||0),ticker,funding:+mark.lastFundingRate,nextFunding:+mark.nextFundingTime,symbol};
    if(!Array.isArray(entry)||!Array.isArray(trend))throw new Error('The exchange returned incomplete candles. Try refreshing.');
    activeSymbol=symbol;activeHorizon=horizon;fetchedAt=Date.now();result=analyze(raw,horizon,cost());
    $('contract').value=symbol;save('compass-contract',symbol);save('compass-horizon',horizon);
    const url=new URL(location.href);url.searchParams.set('contract',symbol);url.searchParams.set('horizon',horizon);history.replaceState(null,'',url);
    render();
  }catch(e){if(id!==requestId)return;raw=null;result=null;$('empty').hidden=false;if(!signal.aborted)showError(e.message||'The analysis could not be completed. Try again.');}
  finally{if(id===requestId)setBusy(false);}
}
function render(){
  if(!result)return;
  const r=result,t=raw.ticker,h=HORIZONS[activeHorizon],age=Date.now()-fetchedAt;
  const expired=r.stale||age>120000,signal=expired?'wait':r.signal;
  $('results').hidden=false;$('empty').hidden=true;
  $('results').classList.toggle('stale',expired);
  $('market-symbol').textContent=activeSymbol;$('coin-icon').textContent=meta.baseAsset.slice(0,1);$('price').textContent=price(raw.markPrice);
  const change=+t.priceChangePercent;$('change').textContent=(change>=0?'↗ +':'↘ ')+change.toFixed(2)+'%';$('change').className='change '+(change>=0?'positive':'negative');
  $('high').textContent=price(+t.highPrice);$('low').textContent=price(+t.lowPrice);$('volume').textContent=compact.format(+t.quoteVolume);$('funding').textContent=(raw.funding>=0?'+':'')+(raw.funding*100).toFixed(4)+'%';
  $('chart-interval').textContent=h.entry+' candles';$('chart-caption').textContent='Last 70 closed candles · '+h.trend+' trend filter';
  $('freshness').textContent=expired?'Expired':'Snapshot';$('verdict').className='verdict '+signal;$('signal').textContent=expired?'Refresh the data':signal==='long'?'Long setup':signal==='short'?'Short setup':'Wait for a setup';
  $('signal-sub').textContent=expired?'This setup needs a fresh check.':signal==='wait'?'Patience is a position.':'Conditions align. Recheck before entry.';$('verdict-icon').textContent=signal==='long'?'↗':signal==='short'?'↘':'Ⅱ';
  $('reason').textContent=expired?'This snapshot is more than two minutes old or the exchange data is delayed. Refresh before considering a trade.':r.reason;
  $('trend-value').textContent=r.trendDirection==='up'?'↗ Upward':r.trendDirection==='down'?'↘ Downward':'↔ Mixed';
  $('rsi-value').textContent=r.rsi.toFixed(1)+' · '+(r.rsi>70?'Elevated':r.rsi<30?'Depressed':r.rsi>=55?'Positive':r.rsi<=45?'Negative':'Neutral');
  $('volume-value').textContent=r.volumeRatio.toFixed(2)+'× · '+(r.volumeRatio>=1.2?'Confirmed':'Below threshold');
  $('rr-value').textContent=signal==='wait'?'See scenarios':r[signal].rr.toFixed(2)+'× net';
  $('horizon-label').textContent=h.label+' horizon';
  $('updated').textContent=(expired?'Expired snapshot':'Updated')+' '+time(raw.serverTime,true)+' · Last candle closed '+time(r.closedAt);
  const untilFunding=raw.nextFunding-raw.serverTime;
  $('funding-note').hidden=!(untilFunding>=0&&untilFunding<h.ms);
  $('funding-note').textContent=`Funding is scheduled within this holding window (${time(raw.nextFunding)}). Current rate: ${(raw.funding*100).toFixed(4)}%. ${raw.funding>0?'Longs currently pay shorts':raw.funding<0?'Shorts currently pay longs':'Current funding is zero'}. The rate can change; funding is not included in the calculator.`;
  renderPlans(expired);renderChart();renderRisk();
}
function renderPlans(expired){
  $('plans').innerHTML=['long','short'].map(dir=>{
    const p=result[dir],isLong=dir==='long',state=expired?'Expired':result.signal===dir?'Conditions aligned':!p.valid?'Costs too high':p.blocked?'Nearby price barrier':p.extended?'Move extended':'Watch scenario';
    const condition=`A completed ${HORIZONS[activeHorizon].entry} candle must close ${isLong?'above':'below'} ${price(p.trigger)}, with aligned trend, RSI, and volume. A wick alone does not qualify.`;
    return `<article class="plan ${dir}"><div class="plan-head"><h3><span aria-hidden="true">${isLong?'↗':'↘'}</span>${isLong?'Buy / Long':'Sell / Short'}</h3><span class="plan-status">${state}</span></div><p>${condition}</p><dl class="plan-levels"><div><dt>${p.crossed?'Reference entry':'Entry trigger'}</dt><dd>${price(p.entry)}</dd></div><div><dt>Stop reference</dt><dd>${price(p.stop)}</dd></div><div><dt>Projected target 1</dt><dd>${price(p.target1)}</dd></div><div><dt>Projected target 2</dt><dd>${price(p.target2)}</dd></div></dl><div class="plan-foot"><span>Net reward / risk <strong>${p.rr.toFixed(2)}×</strong> to target 2</span><span>ATR 14 <strong>${price(result.atr)}</strong></span></div>${p.blocked?`<div class="plan-caution">A nearby ${isLong?'resistance':'support'} pivot at ${price(p.obstacle)} limits the path. This blocks a signal.</div>`:''}${!p.valid?'<div class="plan-caution">Projected reward is insufficient after costs, or a price level is invalid. Skip this scenario.</div>':''}${p.extended?'<div class="plan-caution">Price is extended beyond the trigger. Wait for a new setup.</div>':''}</article>`;
  }).join('');
}
function renderRisk(){
  if(!result)return;
  const out=$('risk-output');out.replaceChildren();
  if(result.stale||Date.now()-fetchedAt>120000){out.textContent='Refresh the market data before sizing a scenario.';return;}
  if(!$('risk-form').checkValidity()){out.textContent='Enter valid values to estimate position size.';return;}
  try{
    const p=result[$('plan-choice').value];
    if(p.stop<=0||p.target2<=0){out.textContent='This scenario has invalid price levels. Wait for a better setup.';return;}
    const s=sizePosition(p,{balance:+$('balance').value,riskPct:+$('risk').value,leverage:+$('leverage').value,...cost(),step:raw.step,minQty:raw.minQty,minNotional:raw.minNotional});
    const unit=meta.baseAsset;
    out.innerHTML=`<dl><dt>Quantity · ${escape(unit)}</dt><dd>${s.qty.toLocaleString('en-US',{maximumFractionDigits:8})}</dd></dl><dl><dt>Position · USDT</dt><dd>${number.format(s.notional)}</dd></dl><dl><dt>Initial margin · USDT</dt><dd>${number.format(s.margin)}</dd></dl><dl><dt>Est. loss at stop · USDT</dt><dd>${number.format(s.estimatedLoss)}</dd></dl>`;
    const warnings=[];
    if(!p.valid)warnings.push('This scenario fails the net reward/risk check. The sizing is illustrative; skip this setup.');
    if(!s.affordable)warnings.push('Estimated margin plus entry costs exceed this balance. Reduce the risk amount.');
    if(!s.meetsMinimum)warnings.push('The quantity is below this contract’s minimum order size or notional.');
    if(+$('risk').value>2)warnings.push('This risks more than 2% of the entered balance on one scenario.');
    if(+$('leverage').value>5)warnings.push('Higher leverage leaves less room before liquidation. This calculator does not estimate liquidation.');
    if(result.signal!==p.direction)warnings.push('This is a conditional scenario, not a confirmed entry.');
    if(warnings.length){const p=document.createElement('p');p.className='risk-warning';p.textContent=warnings.join(' ');out.append(p);}
  }catch(e){out.textContent=e.message;}
}
function renderChart(){
  const c=result.candles.slice(-70),offset=result.candles.length-c.length,e=result.e20.slice(offset),svg=$('chart');
  const W=900,H=380,L=16,R=83,T=35,B=50,plotH=H-T-B-55,plotW=W-L-R;
  const min=Math.min(...c.map(x=>x.low),result.support),max=Math.max(...c.map(x=>x.high),result.resistance),pad=Math.max((max-min)*.12,raw.tickSize*4),lo=min-pad,hi=max+pad;
  const x=i=>L+(i+.5)*plotW/c.length,y=v=>T+(hi-v)/(hi-lo)*plotH;
  const maxVol=Math.max(...c.map(a=>a.volume),1),volBase=H-B;
  let html=`<title id="chart-title">${escape(activeSymbol)} completed ${HORIZONS[activeHorizon].entry} candlesticks</title><desc id="chart-desc">Recent support ${price(result.support)}, resistance ${price(result.resistance)}. Last completed close ${price(c.at(-1).close)}. Blue hollow candles rose; orange filled candles fell.</desc>`;
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,yy=y(v);html+=`<line class="chart-grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text x="${W-R+10}" y="${yy+4}">${price(v)}</text>`;}
  for(const [v,label] of [[result.support,'Support'],[result.resistance,'Resistance']]){const yy=y(v);html+=`<line class="level-line" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text x="${L+6}" y="${yy-7}">${label} ${price(v)}</text>`;}
  const bw=Math.max(2,plotW/c.length*.57);
  c.forEach((a,i)=>{const cl=a.close>=a.open?'candle-up':'candle-down',xx=x(i);html+=`<g><title>${escape(time(a.time))} · Open ${price(a.open)} · High ${price(a.high)} · Low ${price(a.low)} · Close ${price(a.close)}</title><line class="${cl} candle-wick" x1="${xx}" y1="${y(a.high)}" x2="${xx}" y2="${y(a.low)}"/><rect class="${cl}" x="${xx-bw/2}" y="${Math.min(y(a.open),y(a.close))}" width="${bw}" height="${Math.max(1,Math.abs(y(a.open)-y(a.close)))}"/><rect class="${cl}" opacity=".42" x="${xx-bw/2}" y="${volBase-a.volume/maxVol*39}" width="${bw}" height="${a.volume/maxVol*39}"/></g>`;});
  html+=`<path class="ema-path" d="${e.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ')}"/>`;
  for(let i=0;i<c.length;i+=14)html+=`<text x="${x(i)}" y="${H-17}" text-anchor="${i===0?'start':'middle'}">${escape(time(c[i].time))}</text>`;
  svg.innerHTML=html;
}
$('search-form').addEventListener('submit',e=>{e.preventDefault();load();});
$('cancel').addEventListener('click',()=>{requestId++;controller?.abort();setBusy(false);invalidate();});
$('contract').addEventListener('input',()=>{requestId++;controller?.abort();setBusy(false);invalidate();});
$('horizon').addEventListener('change',()=>load());
document.querySelectorAll('[data-symbol]').forEach(b=>b.addEventListener('click',()=>{$('contract').value=b.dataset.symbol;load();}));
$('refresh').addEventListener('click',()=>load());
$('risk-form').addEventListener('submit',e=>e.preventDefault());
$('risk-form').addEventListener('input',()=>renderRisk());
for(const id of ['fee','slip'])$(id).addEventListener('input',()=>{if(raw&&$('risk-form').checkValidity()){result=analyze(raw,activeHorizon,cost());render();}else{if(result){$('signal').textContent='Check cost assumptions';$('reason').textContent='Enter valid fees and slippage before using these scenarios.';$('plans').replaceChildren();}renderRisk();}});
$('plan-choice').addEventListener('change',renderRisk);
$('theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';save('compass-theme',dark?'dark':'light');$('theme').setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');});
const theme=read('compass-theme');if(theme==='dark'){document.documentElement.dataset.theme='dark';$('theme').setAttribute('aria-label','Switch to light theme');}
const params=new URLSearchParams(location.search);$('contract').value=params.get('contract')||read('compass-contract')||'SOLUSDT';const initialH=params.get('horizon')||read('compass-horizon');if(HORIZONS[initialH])$('horizon').value=initialH;
setInterval(()=>{if(!document.hidden&&!controller?.signal.aborted&&!$('analyze').disabled&&result&&$('auto-refresh').checked)load();},60000);
setInterval(()=>{if(result&&Date.now()-fetchedAt>120000&&$('freshness').textContent!=='Expired')render();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&result&&Date.now()-fetchedAt>60000){if($('auto-refresh').checked)load();else render();}});
load();
