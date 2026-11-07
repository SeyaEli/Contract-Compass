import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {normalizeSettings,adsText} from '../dist/monetization-policy.js';
import {guides,informationPages} from '../content/pages.mjs';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const footer=`<footer class="site-footer"><span>Contract Compass</span><nav aria-label="Site information"><a href="/learn/">Learn</a><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/privacy.html">Privacy</a><button type="button" data-privacy-open>Privacy choices</button></nav></footer>`;
const dialog=`<dialog id="privacy-dialog" class="privacy-dialog" aria-labelledby="privacy-heading"><form method="dialog" id="privacy-form"><h2 id="privacy-heading">Privacy choices</h2><p>The workspace works with optional measurement switched off.</p><label><input id="analytics-choice" type="checkbox"><span>Allow optional usage measurement<br><span class="small-note">Known page visits only. No calculator inputs, signals, or URL queries.</span></span></label><p id="privacy-status" class="small-note" role="status"></p><p id="advertising-status">Advertising is disabled on this site.</p><button id="advertising-choices" type="button" class="secondary-button" hidden>Advertising choices</button><p><a href="/privacy.html">Read the privacy notice</a></p><div class="dialog-actions"><button type="submit" value="save" class="primary-button">Save choices</button><button type="submit" value="cancel" class="secondary-button">Cancel</button></div></form></dialog>`;
const ad=`<aside id="advertisement" class="advertisement" aria-label="Advertisement" hidden><p>Advertisement</p><div id="advertisement-content"></div></aside>`;

function csp(live){
  const adScript=live?' https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://www.gstatic.com':'';
  const adImages=live?' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com':'';
  const adConnect=live?' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://fundingchoicesmessages.google.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google':'';
  const frames=live?"'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://fundingchoicesmessages.google.com":"'none'";
  return `default-src 'self'; script-src 'self'${adScript}; style-src 'self'; img-src 'self' data:${adImages}; font-src 'self'; connect-src 'self' https://fapi.binance.com wss://fstream.binance.com${adConnect}; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src ${frames}; worker-src 'none'`;
}

export function buildSite({root=process.cwd(),settings}={}){
  const config=normalizeSettings(settings??JSON.parse(readFileSync(join(root,'site-settings.json'),'utf8')));
  const dist=join(root,'dist'),policy=csp(config.ads.mode==='live');
  const hash=name=>createHash('sha256').update(readFileSync(join(dist,name))).digest('hex').slice(0,10);
  const servicePath=join(dist,'site.js');
  writeFileSync(servicePath,readFileSync(servicePath,'utf8').replace(/from '\.\/monetization-policy\.js(?:\?v=[a-f0-9]+)?'/,`from './monetization-policy.js?v=${hash('monetization-policy.js')}'`));
  const siteAssets=`<link rel="stylesheet" href="/site.css?v=${hash('site.css')}"><script type="module" src="/site.js?v=${hash('site.js')}"></script>`;
  const metadata=path=>`<link rel="canonical" href="${escape(config.origin+path)}">${config.ads.mode!=='off'?`<meta name="google-adsense-account" content="ca-${config.ads.publisherId}">`:''}`;
  const page=(path,title,description,body,learn=false)=>`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>${escape(title)} — Contract Compass</title><meta name="description" content="${escape(description)}"><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css?v=${hash('styles.css')}">${siteAssets}${metadata(path)}</head><body><a class="skip" href="#article">Skip to content</a><header class="site-header"><a class="wordmark" href="/">Contract <strong>Compass</strong></a><nav class="site-nav" aria-label="Main navigation"><a href="/">Workspace</a><a href="/learn/"${learn?' aria-current="page"':''}>Learn</a><a href="/about.html">About</a><a href="/contact.html">Contact</a></nav><button id="site-theme" type="button" class="secondary-button" aria-label="Change theme">Theme</button></header><main class="document" id="article"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Workspace</a>${learn?'<span aria-hidden="true">/</span><a href="/learn/">Learn</a>':''}</nav><h1>${escape(title)}</h1><p class="description">${escape(description)}</p>${body}${footer}${dialog}</main></body></html>\n`;
  const pages=informationPages(config).map(p=>({...p,html:page('/'+p.path,p.title,p.description,`<article class="reading">${p.body}</article>`)}));
  for(const guide of guides){const path=`learn/${guide.slug}.html`;pages.push({path,html:page('/'+path,guide.title,guide.summary,`<p class="article-meta">Contract Compass guide · Updated November 6, 2026</p><article class="reading">${guide.body}</article><nav class="related-reading" aria-label="More learning"><a href="/learn/">All learning guides</a> · <a href="/">Open the workspace</a></nav>`,true)});}
  pages.push({path:'learn/index.html',html:page('/learn/','Learn before using a signal','Practical explanations of the decision, the data, and the risk estimate. Start with the concept you need.',`<ul class="article-list">${guides.map(g=>`<li><h2><a href="/learn/${g.slug}.html">${escape(g.title)}</a></h2><p>${escape(g.summary)}</p></li>`).join('')}</ul><p class="small-note">These guides explain the app. They do not establish a win rate or make futures suitable for everyone.</p>`,true)});
  for(const p of pages){mkdirSync(dirname(join(dist,p.path)),{recursive:true});writeFileSync(join(dist,p.path),p.html);}
  let html=readFileSync(join(dist,'index.html'),'utf8').replace(/\r\n/g,'\n');
  html=html.replace(/<!-- site-build:start -->[\s\S]*?<!-- site-build:end -->/g,'').replace(/<dialog id="privacy-dialog"[\s\S]*?<\/dialog>/g,'').replace(/<aside id="advertisement"[^>]*>[\s\S]*?<\/aside>/g,'');
  html=html.replace(/<footer[\s\S]*?<\/footer>/,footer+dialog);
  html=html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]+/,`$1${policy}`);
  html=html.replace('</head>',`<!-- site-build:start -->${siteAssets}${metadata('/')}<!-- site-build:end --></head>`);
  html=html.replace(/app\.js\?v=[a-f0-9]+/,`app.js?v=${hash('app.js')}`).replace(/styles\.css\?v=[a-f0-9]+/,`styles.css?v=${hash('styles.css')}`);
  if(!html.includes('href="/learn/" class="rail-link"'))html=html.replace('  <div class="rail-note">','  <a href="/learn/" class="rail-link" aria-label="Learning guides" title="Learning guides"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v15M3 4c4-1 6 0 9 1 3-1 5-2 9-1v15c-4-1-6 0-9 1-3-1-5-2-9-1Z"/></svg><span>Learning guides</span></a>\n  <div class="rail-note">');
  html=html.replace('\n  </div>\n  <section id="signal-history"',`${ad}\n  </div>\n  <section id="signal-history"`);
  writeFileSync(join(dist,'index.html'),html);
  writeFileSync(join(dist,'monetization.json'),JSON.stringify(config,null,2)+'\n');
  writeFileSync(join(dist,'ads.txt'),adsText(config));
  writeFileSync(join(dist,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${config.origin}/sitemap.xml\n`);
  const routes=['/',...pages.map(p=>p.path==='learn/index.html'?'/learn/':'/'+p.path)];
  writeFileSync(join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(p=>`<url><loc>${escape(config.origin+p)}</loc></url>`).join('')}</urlset>\n`);
  return {routes,mode:config.ads.mode};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildSite()));
