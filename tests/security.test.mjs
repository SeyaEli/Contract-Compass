import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('SEC-01: Delivered HTML restricts executable code and outbound connections',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/http-equiv="Content-Security-Policy"/);
  assert.match(html,/script-src 'self'/);assert.match(html,/object-src 'none'/);assert.match(html,/base-uri 'none'/);
  assert.match(html,/connect-src 'self' https:\/\/fapi\.binance\.com wss:\/\/fstream\.binance\.com/);
  assert.doesNotMatch(html,/unsafe-inline|unsafe-eval|\son[a-z]+\s*=/i);
  assert.match(html,/name="referrer" content="no-referrer"/);
});
test('SEC-02: Production has no package dependency or embedded exchange credential',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(pkg.dependencies||{}).length,0);
  for(const name of ['app.js','engine.js','market-data.js','monitor.js','signal-state.js']){
    const source=readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/X-MBX-APIKEY|Bearer\s+[A-Za-z0-9_-]{16,}|art_v2_|\beval\s*\(|new Function\s*\(/);
  }
});
