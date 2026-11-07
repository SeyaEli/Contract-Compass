import {normalizeSettings,advertisingDecision,analyticsEvent,measurementAllowed} from './monetization-policy.js?v=ea9589e843';

const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
const signals=()=>({gpc:navigator.globalPrivacyControl===true,dnt:navigator.doNotTrack});
let preference=null;
try{preference=JSON.parse(read('compass-privacy-v1'));}catch{}
let config=null,analyticsStarted=false,adAllowed=false,adStarted=false;
const dialog=document.getElementById('privacy-dialog'),status=document.getElementById('privacy-status'),choice=document.getElementById('analytics-choice');
const localFile=(name)=>new URL('/'+name,location.origin).href;

if(read('compass-theme')==='dark')document.documentElement.dataset.theme='dark';
document.getElementById('site-theme')?.addEventListener('click',()=>{
  const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';write('compass-theme',dark?'dark':'light');
});

function showPreferences(){
  choice.checked=preference?.version===1&&preference.analytics===true;
  choice.disabled=!config?.analytics||signals().gpc||signals().dnt==='1';
  status.textContent=signals().gpc||signals().dnt==='1'?'Your browser privacy signal keeps optional measurement off.':!config?'Optional services are unavailable; the workspace still works.':!config.analytics?'Usage measurement is not configured.':'Measurement is optional. You can change this choice at any time.';
  document.getElementById('advertising-status').textContent=config?.ads.mode==='live'?'Advertising uses a separate certified Google consent message. Declining it leaves the workspace available.':'Advertising is disabled on this site.';
  document.getElementById('advertising-choices').hidden=!(config?.ads.mode==='live'&&typeof window.googlefc?.showRevocationMessage==='function');
  dialog.showModal();
}
document.querySelectorAll('[data-privacy-open]').forEach(button=>button.addEventListener('click',showPreferences));
document.getElementById('advertising-choices')?.addEventListener('click',()=>{dialog.close();window.googlefc?.showRevocationMessage?.();});
document.getElementById('privacy-form')?.addEventListener('submit',event=>{
  if(event.submitter?.value!=='save')return;
  const wasEnabled=preference?.analytics===true;
  preference={version:1,analytics:choice.checked&&!choice.disabled};
  write('compass-privacy-v1',JSON.stringify(preference));
  if(wasEnabled&&!preference.analytics&&analyticsStarted){location.reload();return;}
  startMeasurement();
});

function script(src,id){
  return new Promise((resolve,reject)=>{const element=document.createElement('script');element.id=id;element.src=src;element.async=true;element.crossOrigin='anonymous';element.addEventListener('load',()=>resolve(element),{once:true});element.addEventListener('error',()=>{element.remove();reject(new Error('Optional service unavailable'));},{once:true});document.head.append(element);});
}

async function startMeasurement(){
  if(!config||analyticsStarted||!measurementAllowed(config,preference,signals()))return;
  analyticsStarted=true;
  try{
    const url=localFile('_vercel/insights/script.js');
    const response=await fetch(url,{method:'HEAD',credentials:'omit',signal:AbortSignal.timeout(5000)});
    if(!response.ok||!/javascript/.test(response.headers.get('content-type')||''))return;
    if(!measurementAllowed(config,preference,signals()))return;
    window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};
    window.va('beforeSend',event=>measurementAllowed(config,preference,signals())?analyticsEvent(event):null);
    await script(url,'compass-measurement');
  }catch{/* Optional measurement must never interrupt the workspace. */}
}

async function displayAd(){
  const placement=document.getElementById('advertisement');
  if(!placement||adStarted||!adAllowed||document.hidden)return;
  adStarted=true;
  const unit=document.createElement('ins');unit.className='adsbygoogle';unit.dataset.adClient='ca-'+config.ads.publisherId;unit.dataset.adSlot=config.ads.slotId;unit.dataset.adFormat='auto';unit.dataset.fullWidthResponsive='true';
  document.getElementById('advertisement-content').replaceChildren(unit);
  try{
    await script('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-'+config.ads.publisherId,'compass-ad-script');
    if(!adAllowed||document.hidden){placement.hidden=true;return;}
    (window.adsbygoogle=window.adsbygoogle||[]).push({});
  }catch{placement.hidden=true;}
}

function startAdvertising(){
  if(config.ads.mode!=='live'||signals().gpc||signals().dnt==='1')return;
  const placement=document.getElementById('advertisement');
  let inView=false;
  const observer=placement?new IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);if(inView&&adAllowed)displayAd();},{rootMargin:'150px'}):null;
  if(placement)observer.observe(placement);
  window.googlefc=window.googlefc||{};window.googlefc.callbackQueue=window.googlefc.callbackQueue||[];
  window.googlefc.callbackQueue.push({CONSENT_API_READY:()=>{
    if(typeof window.__tcfapi!=='function')return;
    window.__tcfapi('addEventListener',2,(data,success)=>{
      const decision=advertisingDecision(config,{data,success,started:adStarted,signals:signals()});adAllowed=decision.allowed;
      if(placement)placement.hidden=!adAllowed;
      if(decision.reload){observer?.disconnect();document.getElementById('advertisement-content')?.replaceChildren();document.getElementById('compass-ad-script')?.remove();location.reload();return;}
      if(adAllowed&&inView)displayAd();
    });
  }});
  script('https://fundingchoicesmessages.google.com/i/'+config.ads.publisherId+'?ers=1','compass-certified-consent').catch(()=>{if(placement)placement.hidden=true;});
  window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
}

try{
  const response=await fetch(localFile('monetization.json'),{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(response.ok){config=normalizeSettings(await response.json());startMeasurement();startAdvertising();}
}catch{/* Invalid or absent configuration leaves optional services off. */}
