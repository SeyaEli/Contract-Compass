import {HORIZONS,normalizeSymbol,analyze,sizePosition} from './engine.js';
import {createMarketClient} from './market-data.js';
import {MarketMonitor} from './monitor.js';
import {decisionSignal,signalIdentity} from './signal-state.js';
import {readViewMode,beginnerGuidance} from './view-mode.js';

const $=id=>document.getElementById(id);

const iconPaths={long:'<path d="M5 18 19 4M7 4h12v12"/>',short:'<path d="m5 6 14 14M7 20h12V8"/>',watch:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',pause:'<path d="M8 5v14M16 5v14"/>',check:'<path d="m5 12 4 4L19 6"/>',pending:'<circle cx="12" cy="12" r="7"/>'};
function svgIcon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]||iconPaths.pending}</svg>`;}

const client=createMarketClient();
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let raw=null,result=null,meta=null,controller=null,requestId=0,fetchedAt=0,activeSymbol='',activeHorizon='1h';
let quote=null,connection='connecting',monitoring=true,refreshing=false,decision=null,lastActivity='',lastCandle=0,presentationKey='',expectedClosedAt=0;
const seenAlerts=new Set(),activity=[];
let viewMode='current',advancedOpen=false,lastAnnouncement='';
const cost=()=>({fee:+$('fee').value,slip:+$('slip').value});
function costsValid(){return ['fee','slip'].every(id=>$(id).value!==''&&$(id).checkValidity());}
function dp(){return Math.min(8,Math.max(2,Math.ceil(-Math.log10(raw?.tickSize||.01))));}
function price(v){return Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:dp(),maximumFractionDigits:dp()}):'—';}
function time(v,withDate=false){return new Intl.DateTimeFormat(undefined,{...(withDate?{month:'short',day:'numeric'}:{}),hour:'2-digit',minute:'2-digit',second:withDate?'2-digit':undefined,timeZoneName:withDate?'short':undefined}).format(v);}
function save(key,value){try{localStorage.setItem(key,value);}catch{}}
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function serverNow(){return raw?raw.serverTime+Date.now()-fetchedAt:Date.now();}
function setBusy(b,silent=false){refreshing=b;$('analyze').disabled=b;$('analyze').setAttribute('aria-busy',String(b));$('analyze').textContent=b?'Checking…':viewMode==='beginner'?'Check this coin':'Analyze contract';$('cancel').hidden=!b||silent;$('loading').hidden=!b||silent;$('refresh').disabled=b;}
function applyView(){
  const beginner=viewMode==='beginner';
  document.documentElement.dataset.view=viewMode;document.documentElement.dataset.advanced=String(advancedOpen);
  $('beginner-toggle').checked=beginner;$('advanced-toggle').setAttribute('aria-expanded',String(advancedOpen));$('advanced-toggle').textContent=advancedOpen?'Hide advanced details':'Show advanced details';
  $('page-title').textContent=beginner?'Check a coin. Understand the result.':'Market overview';
  $('page-description').textContent=beginner?'A simple explanation of what the app sees, and what it means.':'Review the live signal, then check the setup and risk.';
  document.querySelector('label[for="contract"]').textContent=beginner?'Coin symbol or trading pair':'Contract';
  document.querySelector('label[for="horizon"]').textContent=beginner?'How long would you hold a trade?':'Planned holding time';
  $('contract-help').textContent=beginner?'Type SOL or SOLUSDT, or choose a coin below. No exchange login needed.':'Binance USDT perpetuals · No account or API key needed';
  const coins={BTCUSDT:'Bitcoin (BTC)',ETHUSDT:'Ethereum (ETH)',SOLUSDT:'Solana (SOL)'};
  document.querySelectorAll('[data-symbol]').forEach(b=>{b.textContent=beginner?coins[b.dataset.symbol]:b.dataset.symbol.replace('USDT','');});
  if(!$('analyze').disabled)$('analyze').textContent=beginner?'Check this coin':'Analyze contract';
  $('decision-heading').textContent=beginner?'Read this result first':'Use this decision signal';
  document.querySelector('.signal-rule').innerHTML=beginner?'A <strong>possible setup</strong> means the app’s checks agree. It is not a promise of profit. <strong>Wait</strong> means no confirmed entry.':'Only <strong>Long signal</strong> or <strong>Short signal</strong> means the technical entry checks agree. <strong>Watch</strong> and <strong>Wait</strong> are not entries.';
  document.querySelector('.market-price small').textContent=beginner?'Reference price · USDT':'Mark price · USDT';
  if(raw)$('updated').textContent=beginner?'Last checked '+time(raw.serverTime,true):'Analysis '+time(raw.serverTime,true)+' · Last candle '+time(result.closedAt);
  $('beginner-explanation').textContent='The app compares the price direction, the strength of the move, trading activity, and estimated costs. If the checks do not agree, it waits.';
  if(result){renderDecision();renderRisk();}
}
const monitor=new MarketMonitor({serverNow,onStatus:s=>{connection=s;renderDecision();},onEvent:event=>{
  if(!raw)return;
  if(event.kind==='quote'){
    quote={price:event.price,receivedAt:Date.now(),eventTime:event.eventTime};raw.funding=event.funding;raw.nextFunding=event.nextFunding;
    $('price').textContent=price(quote.price);$('funding').textContent=(raw.funding>=0?'+':'')+(raw.funding*100).toFixed(4)+'%';renderDecision();
  }else if(event.closedAt>lastCandle){lastCandle=event.closedAt;expectedClosedAt=event.closedAt;renderDecision();load({silent:true});}
}});
function invalidate(){monitor.stop();quote=null;raw=null;result=null;decision=null;expectedClosedAt=0;lastCandle=0;$('results').hidden=true;$('empty').hidden=false;$('error').hidden=true;$('signal-notice').hidden=true;renderDecision();}
function showError(message){$('error').replaceChildren();const strong=document.createElement('strong');strong.textContent='Analysis unavailable';const p=document.createElement('p');p.textContent=message;const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.addEventListener('click',()=>load());$('error').append(strong,p,retry);$('error').hidden=false;}
async function load({silent=false}={}){
  if(silent&&(!monitoring||document.hidden||refreshing||!result))return;
  const id=++requestId;controller?.abort();controller=new AbortController();
  let symbol;try{symbol=normalizeSymbol($('contract').value);}catch(e){invalidate();showError(e.message);setBusy(false);return;}
  const horizon=$('horizon').value;
  if(!silent){invalidate();$('empty').hidden=true;}
  setBusy(true,silent);renderDecision();$('loading-detail').textContent='Checking contract details and completed candles…';
  try{
    const data=await client.snapshot(symbol,horizon,controller.signal);if(id!==requestId)return;
    meta=data.meta;raw=data.raw;activeSymbol=symbol;activeHorizon=horizon;fetchedAt=Date.now();
    if(!quote||quote.eventTime<raw.markTime)quote={price:raw.markPrice,receivedAt:fetchedAt,eventTime:raw.markTime};
    if(costsValid())result=analyze(raw,horizon,cost());else result=analyze(raw,horizon);
    lastCandle=Math.max(lastCandle,result.closedAt);
    $('contracts').replaceChildren(...data.catalog.map(x=>{const o=document.createElement('option');o.value=x.symbol;return o;}));
    $('contract').value=symbol;save('compass-contract',symbol);save('compass-horizon',horizon);
    const url=new URL(location.href);url.searchParams.set('contract',symbol);url.searchParams.set('horizon',horizon);history.replaceState(null,'',url);
    $('error').hidden=true;render();
    if(monitoring&&!document.hidden&&(!monitor.enabled||monitor.symbol!==symbol||monitor.interval!==HORIZONS[horizon].entry))monitor.start(symbol,HORIZONS[horizon].entry);
  }catch(e){
    if(id!==requestId)return;
    if(!controller.signal.aborted){monitor.stop();connection='offline';if(silent&&result){renderDecision();}else{raw=null;result=null;$('empty').hidden=false;}$('loading').hidden=true;showError(e.message||'The analysis could not be completed. Try again.');}
  }finally{if(id===requestId){setBusy(false,silent);renderDecision();}}
}
function render(){
  if(!result)return;
  const r=result,t=raw.ticker,h=HORIZONS[activeHorizon];
  $('results').hidden=false;$('empty').hidden=true;
  $('market-symbol').textContent=activeSymbol;$('coin-icon').textContent=meta.baseAsset.slice(0,1);$('price').textContent=price(quote?.price??raw.markPrice);
  const change=+t.priceChangePercent;$('change').textContent=(change>=0?'+':'')+change.toFixed(2)+'%';$('change').className='change '+(change>=0?'positive':'negative');
  $('high').textContent=price(+t.highPrice);$('low').textContent=price(+t.lowPrice);$('volume').textContent=compact.format(+t.quoteVolume);$('funding').textContent=(raw.funding>=0?'+':'')+(raw.funding*100).toFixed(4)+'%';
  $('chart-interval').textContent=h.entry+' candles';$('chart-caption').textContent='Closed candles · '+h.trend+' trend filter';$('horizon-label').textContent=h.label+' horizon';
  $('updated').textContent=viewMode==='beginner'?'Last checked '+time(raw.serverTime,true):'Analysis '+time(raw.serverTime,true)+' · Last candle '+time(r.closedAt);
  renderChart();renderDecision();renderRisk();
}
function renderDecision(){
  const now=Date.now();
  const state=decisionSignal({analysis:result,price:quote?.price,quoteAt:quote?.receivedAt,analysisAt:fetchedAt,now,connection,monitoring,visible:!document.hidden,costsValid:costsValid(),refreshing,expectedClosedAt});
  decision=state;
  const monitorLabel=!monitoring?'Monitoring paused':document.hidden?'Paused in background':connection==='live'?'Live market monitoring':connection==='reconnecting'?'Reconnecting to live prices':connection==='offline'?'Live feed unavailable':'Connecting to live prices';
  $('monitor-status').textContent=monitorLabel;$('connection-dot').className='connection-dot '+(connection==='live'&&monitoring?'connected':'');
  const age=quote?Math.max(0,Math.floor((now-quote.receivedAt)/1000)):null;
  const announcementKey=[activeSymbol,activeHorizon,state.code,state.reason,monitorLabel,viewMode].join(':');
  if(announcementKey!==lastAnnouncement){
    lastAnnouncement=announcementKey;
    const title=viewMode==='beginner'?beginnerGuidance(state).title:state.title;
    $('decision-announcement').textContent=result?`${activeSymbol}. ${title}. ${state.reason} ${monitorLabel}.`:monitorLabel+'.';
  }
  $('quote-age').textContent=age===null?'Waiting for the first live price':`Price updated ${age}s ago · Analysis refreshes every 60s`;
  $('monitor-toggle').textContent=monitoring?'Pause monitoring':'Resume monitoring';$('monitor-toggle').setAttribute('aria-pressed',String(monitoring));
  if(!result)return;
  const plain=beginnerGuidance(state),beginner=viewMode==='beginner';
  $('decision-banner').className='decision-banner '+state.tone;$('decision-title').textContent=beginner?plain.title:state.title;$('decision-code').textContent=state.code.replaceAll('_',' ');$('decision-icon').innerHTML=svgIcon(state.code==='LONG'?'long':state.code==='SHORT'?'short':state.code.startsWith('WATCH')?'watch':'pause');
  $('decision-reason').textContent=beginner?plain.explanation:state.reason;$('decision-next').textContent=beginner?plain.next:state.next;$('freshness').textContent=state.code==='NO_SIGNAL'?'Not live':'Fresh data';
  $('results').classList.toggle('stale',state.code==='NO_SIGNAL');
  const span={'1m':60000,'5m':300000,'15m':900000,'1h':3600000}[HORIZONS[activeHorizon].entry];
  const seconds=Math.max(0,Math.ceil((Math.floor(serverNow()/span+1)*span-serverNow())/1000));
  $('next-candle').textContent=`Next ${HORIZONS[activeHorizon].entry} candle close in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const until=raw.nextFunding-serverNow();$('funding-note').hidden=!(until>=0&&until<HORIZONS[activeHorizon].ms);
  $('funding-note').textContent=`Funding falls within this holding window (${time(raw.nextFunding)}). Current rate ${(raw.funding*100).toFixed(4)}%. ${raw.funding>0?'Longs pay shorts':raw.funding<0?'Shorts pay longs':'Currently zero'}. Funding is variable and excluded from sizing.`;
  const nextPresentation=[activeSymbol,activeHorizon,state.code,raw.serverTime,$('fee').value,$('slip').value,viewMode].join(':');
  if(nextPresentation!==presentationKey){presentationKey=nextPresentation;renderChecklist();renderPlans();renderRisk();}
  if(!state.actionable)$('signal-notice').hidden=true;
  const key=signalIdentity(activeSymbol,activeHorizon,state.code,result.closedAt);
  if(key&&!seenAlerts.has(key)){seenAlerts.add(key);if(seenAlerts.size>200)seenAlerts.delete(seenAlerts.values().next().value);if($('alerts-toggle').checked){$('signal-notice').textContent=`New ${state.title.toLowerCase()} for ${activeSymbol} at ${time(now,true)}. Review the entry and risk before deciding.`;$('signal-notice').hidden=false;}}
  const activityKey=[activeSymbol,activeHorizon,state.code].join(':');
  if(!refreshing&&activityKey!==lastActivity){lastActivity=activityKey;activity.unshift({time:now,symbol:activeSymbol,horizon:activeHorizon,title:state.title});if(activity.length>12)activity.pop();$('history-list').replaceChildren(...activity.map(a=>{const li=document.createElement('li');const strong=document.createElement('strong');strong.textContent=a.title;const detail=document.createElement('span');detail.textContent=`${a.symbol} · ${HORIZONS[a.horizon].label} · ${time(a.time,true)}`;li.append(strong,detail);return li;}));}
}
function renderChecklist(){
  const r=result,dir=r.signal==='short'||r.trendDirection==='down'?'short':'long',p=r[dir],long=dir==='long';
  const checks=[
    ['Trend alignment',r.trendDirection!=='mixed',r.trendDirection==='up'?'Upward trend':r.trendDirection==='down'?'Downward trend':'Mixed — wait'],
    ['Closed-candle breakout',p.crossed,p.crossed?'Candle confirmed':'Not confirmed'],
    ['Momentum · RSI 14',long?r.rsi>=55&&r.rsi<=75:r.rsi>=25&&r.rsi<=45,`${r.rsi.toFixed(1)} · needs ${long?'55–75':'25–45'}`],
    ['Volume confirmation',r.volumeRatio>=1.2,`${r.volumeRatio.toFixed(2)}× · needs 1.20×`],
    ['Reward / risk after costs',costsValid()&&p.valid&&!p.blocked&&!p.extended,`${p.rr.toFixed(2)}× net${p.blocked?' · price barrier':p.extended?' · extended':''}`],
    ['Live entry & fresh data',decision.actionable,decision.actionable?'Entry conditions agree':decision.code==='NO_SIGNAL'?'No live confirmation':'Entry not confirmed']
  ];
  $('signal-checklist').replaceChildren(...checks.map(([label,pass,detail])=>{const li=document.createElement('li');li.className=pass?'pass':'pending';const icon=document.createElement('span');icon.className='check-icon';icon.innerHTML=pass?svgIcon('check'):svgIcon('pending');icon.setAttribute('aria-label',pass?'Pass':'Not met');const content=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('span');strong.textContent=label;small.textContent=detail;content.append(strong,small);li.append(icon,content);return li;}));
}
function renderPlans(){
  $('plans').innerHTML=['long','short'].map(dir=>{
    const p=result[dir],long=dir==='long',confirmed=decision.actionable&&decision.code===(long?'LONG':'SHORT');
    const status=confirmed?'Signal confirmed':decision.code==='NO_SIGNAL'?'Reference only':!p.valid?'Skip — costs too high':p.blocked?'Blocked by price barrier':'Scenario only';
    const condition=`A closed ${HORIZONS[activeHorizon].entry} candle must break ${long?'above':'below'} ${price(p.trigger)}, with the remaining checks aligned.`;
    return `<article class="plan ${dir}${confirmed?' confirmed':''}"><div class="plan-head"><h3><span aria-hidden="true">${svgIcon(long?'long':'short')}</span>${long?'Buy / Long':'Sell / Short'}</h3><span class="plan-status">${status}</span></div><p>${condition}</p><dl class="plan-levels"><div><dt>${p.crossed?'Reference entry':'Entry trigger'}</dt><dd>${price(p.entry)}</dd></div><div><dt>Stop reference</dt><dd>${price(p.stop)}</dd></div><div><dt>Projected target 1</dt><dd>${price(p.target1)}</dd></div><div><dt>Projected target 2</dt><dd>${price(p.target2)}</dd></div></dl><div class="plan-foot"><span>Net reward / risk <strong>${p.rr.toFixed(2)}×</strong> to target 2</span><span>ATR 14 <strong>${price(result.atr)}</strong></span></div>${p.blocked?`<p class="plan-caution">Nearby ${long?'resistance':'support'} at ${price(p.obstacle)} blocks this setup.</p>`:''}${!p.valid?'<p class="plan-caution">The projected reward does not justify the risk after costs. Skip this setup.</p>':''}${p.extended?'<p class="plan-caution">The move is extended. Wait for a new setup.</p>':''}</article>`;
  }).join('');
}
function renderRisk(){
  if(!result)return;
  const out=$('risk-output');out.replaceChildren();
  if(result.stale||Date.now()-fetchedAt>90000){out.textContent='Refresh the market data before sizing a scenario.';return;}
  if(!$('risk-form').checkValidity()){out.textContent='Enter valid values to estimate position size.';return;}
  try{
    const p=result[$('plan-choice').value];
    const s=sizePosition(p,{balance:+$('balance').value,riskPct:+$('risk').value,leverage:+$('leverage').value,...cost(),step:raw.step,minQty:raw.minQty,minNotional:raw.minNotional});
    out.innerHTML=`<dl><dt>Quantity · ${escape(meta.baseAsset)}</dt><dd>${s.qty.toLocaleString('en-US',{maximumFractionDigits:8})}</dd></dl><dl><dt>Position · USDT</dt><dd>${number.format(s.notional)}</dd></dl><dl><dt>Initial margin · USDT</dt><dd>${number.format(s.margin)}</dd></dl><dl><dt>Est. loss at stop · USDT</dt><dd>${number.format(s.estimatedLoss)}</dd></dl>`;
    const warnings=[];
    if(!p.valid)warnings.push('This scenario fails the net reward/risk check. Skip this setup.');
    if(!s.affordable)warnings.push('Margin plus estimated entry costs exceed this balance. Reduce the risk amount.');
    if(!s.meetsMinimum)warnings.push('The quantity is below this contract’s minimum order size or value.');
    if(+$('risk').value>2)warnings.push('This risks more than 2% of the entered balance.');
    if(+$('leverage').value>5)warnings.push('Higher leverage leaves less room before liquidation. Liquidation is not calculated here.');
    if(!decision?.actionable||decision.code!==p.direction.toUpperCase())warnings.push('Illustration only: this scenario has no current entry signal.');
    if(warnings.length){const note=document.createElement('p');note.className='risk-warning';note.textContent=warnings.join(' ');out.append(note);}
  }catch(e){out.textContent=e.message;}
}
let chartWidth=0;
function renderChart(){
  const svg=$('chart'),W=Math.max(240,Math.round(svg.parentElement.clientWidth));
  chartWidth=W;
  const c=result.candles.slice(-(W<500?30:70)),offset=result.candles.length-c.length,e=result.e20.slice(offset);
  const H=380,L=12,R=W<500?94:105,T=45,B=50,plotH=H-T-B-55,plotW=W-L-R;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const min=Math.min(...c.map(x=>x.low),result.support),max=Math.max(...c.map(x=>x.high),result.resistance),pad=Math.max((max-min)*.12,raw.tickSize*4),lo=min-pad,hi=max+pad;
  const x=i=>L+(i+.5)*plotW/c.length,y=v=>T+(hi-v)/(hi-lo)*plotH;
  const maxVol=Math.max(...c.map(a=>a.volume),1),volBase=H-B;
  let html=`<title id="chart-title">${escape(activeSymbol)} completed ${HORIZONS[activeHorizon].entry} candlesticks</title><desc id="chart-desc">Recent support ${price(result.support)}, resistance ${price(result.resistance)}. Last completed close ${price(c.at(-1).close)}. Blue hollow candles rose; orange filled candles fell.</desc>`;
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,yy=y(v);html+=`<line class="chart-grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text x="${W-R+10}" y="${yy+4}">${price(v)}</text>`;}
  for(const [v,label] of [[result.support,'Support'],[result.resistance,'Resistance']]){const yy=y(v);html+=`<line class="level-line" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text x="${L+6}" y="${yy-7}">${label} ${price(v)}</text>`;}
  const bw=Math.max(2,plotW/c.length*.57);
  c.forEach((a,i)=>{const cl=a.close>=a.open?'candle-up':'candle-down',xx=x(i);html+=`<g><title>${escape(time(a.time))} · Open ${price(a.open)} · High ${price(a.high)} · Low ${price(a.low)} · Close ${price(a.close)}</title><line class="${cl} candle-wick" x1="${xx}" y1="${y(a.high)}" x2="${xx}" y2="${y(a.low)}"/><rect class="${cl}" x="${xx-bw/2}" y="${Math.min(y(a.open),y(a.close))}" width="${bw}" height="${Math.max(1,Math.abs(y(a.open)-y(a.close)))}"/><rect class="${cl}" opacity=".42" x="${xx-bw/2}" y="${volBase-a.volume/maxVol*39}" width="${bw}" height="${a.volume/maxVol*39}"/></g>`;});
  html+=`<path class="ema-path" d="${e.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ')}"/>`;
  const timeStep=W<500?12:18;
  for(let i=0;i<c.length;i+=timeStep)html+=`<text x="${x(i)}" y="${H-17}" text-anchor="${i===0?'start':'middle'}">${escape(time(c[i].time))}</text>`;
  svg.innerHTML=html;
}

const chartResize=new ResizeObserver(()=>{if(result&&$('chart').parentElement.clientWidth>0&&Math.round($('chart').parentElement.clientWidth)!==chartWidth)renderChart();});
chartResize.observe($('chart').parentElement);

const navigationLinks=[...document.querySelectorAll('.rail a.rail-link[href]')];
function updateNavigation(){
  const selected=navigationLinks.some(a=>a.getAttribute('href')===location.hash)?location.hash:'#main';
  for(const link of navigationLinks){
    const active=link.getAttribute('href')===selected;
    link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange',updateNavigation);
updateNavigation();

$('search-form').addEventListener('submit',e=>{e.preventDefault();load();});
$('beginner-toggle').addEventListener('change',()=>{viewMode=$('beginner-toggle').checked?'beginner':'current';advancedOpen=false;save('compass-view',viewMode);applyView();});
$('advanced-toggle').addEventListener('click',()=>{advancedOpen=!advancedOpen;applyView();});
document.querySelectorAll('a[href="#risk-section"],a[href="#methodology"]').forEach(a=>a.addEventListener('click',()=>{if(viewMode==='beginner'){advancedOpen=true;applyView();}}));
document.querySelector('a[href="#beginner-glossary"]').addEventListener('click',()=>{$('beginner-glossary').open=true;});
$('cancel').addEventListener('click',()=>{requestId++;controller?.abort();setBusy(false);invalidate();});
$('contract').addEventListener('input',()=>{requestId++;controller?.abort();setBusy(false);invalidate();});
$('horizon').addEventListener('change',()=>load());
document.querySelectorAll('[data-symbol]').forEach(b=>b.addEventListener('click',()=>{$('contract').value=b.dataset.symbol;load();}));
$('refresh').addEventListener('click',()=>load());
$('risk-form').addEventListener('submit',e=>e.preventDefault());
$('risk-form').addEventListener('input',renderRisk);
for(const id of ['fee','slip'])$(id).addEventListener('input',()=>{if(raw&&costsValid()){result=analyze(raw,activeHorizon,cost());renderDecision();}else renderDecision();renderRisk();});
$('plan-choice').addEventListener('change',renderRisk);
$('monitor-toggle').addEventListener('click',()=>{monitoring=!monitoring;if(!monitoring){monitor.stop();controller?.abort();requestId++;setBusy(false);renderDecision();renderRisk();}else load();});
$('alerts-toggle').addEventListener('change',()=>{if(!$('alerts-toggle').checked)$('signal-notice').hidden=true;});
$('theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';save('compass-theme',dark?'dark':'light');$('theme').setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');});
if(read('compass-theme')==='dark'){document.documentElement.dataset.theme='dark';$('theme').setAttribute('aria-label','Switch to light theme');}
const params=new URLSearchParams(location.search);$('contract').value=params.get('contract')||read('compass-contract')||'SOLUSDT';const initialH=params.get('horizon')||read('compass-horizon');if(Object.hasOwn(HORIZONS,initialH))$('horizon').value=initialH;
const refreshTimer=setInterval(()=>{if(result&&monitoring&&!document.hidden&&!refreshing)load({silent:true});},60000);
const clockTimer=setInterval(()=>{renderDecision();if(result&&Date.now()-fetchedAt>90000)renderRisk();},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){monitor.stop();controller?.abort();requestId++;setBusy(false);renderDecision();}else if(monitoring)load({silent:!!result});});
window.addEventListener('pagehide',()=>{monitor.stop();controller?.abort();chartResize.disconnect();clearInterval(refreshTimer);clearInterval(clockTimer);});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
viewMode=readViewMode(read('compass-view'));applyView();load();
