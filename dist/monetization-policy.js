export const LEARNING_PATHS=['/learn/reading-signals.html','/learn/position-sizing.html','/learn/futures-basics.html','/learn/data-and-limits.html'];
const analyticsPaths=new Set(['/','/index.html','/about.html','/contact.html','/privacy.html','/learn/','/learn/index.html',...LEARNING_PATHS]);

export function normalizeSettings(input={}){
  const origin=input.origin||'https://contract-compass-beta.vercel.app';
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Site origin must be an HTTPS origin without a path or credentials.');
  const a=input.ads||{},mode=a.mode||'off';
  if(!['off','review','live'].includes(mode))throw new Error('Ad mode must be off, review, or live.');
  const publisherId=a.publisherId||'',slotId=a.slotId||'';
  if(publisherId&&!/^pub-(?!0{16}$)\d{16}$/.test(publisherId))throw new Error('Use the real 16-digit AdSense publisher ID.');
  if(slotId&&!/^\d{10}$/.test(slotId))throw new Error('Use the 10-digit manual ad-unit slot ID.');
  if(mode!=='off'&&!publisherId)throw new Error('A real publisher ID is required for verification.');
  const certifiedCmpId=Number.isInteger(a.certifiedCmpId)&&a.certifiedCmpId>0?a.certifiedCmpId:null;
  const ads={mode,publisherId,slotId,siteApproved:a.siteApproved===true,commercialHosting:a.commercialHosting===true,certifiedCmpId};
  if(mode==='live'&&(!ads.siteApproved||!ads.commercialHosting||!slotId||!certifiedCmpId))throw new Error('Live ads require approval, commercial hosting, a manual unit, and a published certified CMP.');
  return {origin:url.origin,ads,analytics:input.analytics===true};
}

export function advertisingAllowed(config,tcf){
  if(config.ads.mode!=='live'||!config.ads.siteApproved||!config.ads.commercialHosting||!config.ads.publisherId||!config.ads.slotId||!config.ads.certifiedCmpId)return false;
  if(!tcf||tcf.cmpStatus!=='loaded'||tcf.cmpId!==config.ads.certifiedCmpId||!['tcloaded','useractioncomplete'].includes(tcf.eventStatus))return false;
  // This adapter supports TCF-covered visits only. Other regional states fail closed.
  return tcf.gdprApplies===true&&tcf.purpose?.consents?.[1]===true&&tcf.vendor?.consents?.[755]===true;
}

export function advertisingDecision(config,{data,success,started,signals={}}){
  const allowed=success===true&&advertisingAllowed(config,data)&&signals.gpc!==true&&signals.dnt!=='1';
  return {allowed,reload:started===true&&!allowed};
}

export function adsText(config){
  return config.ads.mode==='off'?'# No advertising sellers are currently authorized.\n':`google.com, ${config.ads.publisherId}, DIRECT, f08c47fec0942fa0\n`;
}

export function analyticsEvent(event){
  if(event?.type!=='pageview')return null;
  try{
    const url=new URL(event.url);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!analyticsPaths.has(url.pathname))return null;
    return {type:'pageview',url:url.origin+url.pathname};
  }catch{return null;}
}

export function measurementAllowed(config,preference,signals={}){
  return config.analytics===true&&preference?.version===1&&preference.analytics===true&&signals.gpc!==true&&signals.dnt!=='1';
}
