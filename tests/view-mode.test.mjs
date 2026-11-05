import test from 'node:test';
import assert from 'node:assert/strict';
import {readViewMode,beginnerGuidance} from '../dist/view-mode.js';

test('VIEW-01: Current view is the default and invalid saved preferences are ignored',()=>{
  for(const value of [null,undefined,'','current','<script>','__proto__'])assert.equal(readViewMode(value),'current');
  assert.equal(readViewMode('beginner'),'beginner');
});
test('VIEW-02: Watch states explicitly say to wait and never imply a confirmed entry',()=>{
  for(const code of ['WATCH_LONG','WATCH_SHORT']){
    const text=beginnerGuidance({code});assert.match(text.title,/wait/i);assert.match(text.explanation,/not.*(buy|sell|entry).*signal/i);
  }
});
test('VIEW-03: Confirmed states explain direction and retain risk context',()=>{
  const a=beginnerGuidance({code:'LONG'}),b=beginnerGuidance({code:'SHORT'});
  assert.match(a.title,/buy.*long/i);assert.match(a.explanation,/rises/i);
  assert.match(b.title,/sell.*short/i);assert.match(b.explanation,/falls/i);
  for(const x of [a,b])assert.match(x.next,/lose|loss/i);
});
test('VIEW-04: Missing, unknown, paused, or stale results stay unavailable, without inventing a direction',()=>{
  for(const state of [null,{code:'NO_SIGNAL'},{code:'UNKNOWN'},{code:'WAIT'}]){
    const t=beginnerGuidance(state);assert.match(t.title,/wait|not ready/i);assert.doesNotMatch(t.title,/possible buy|possible sell/i);
  }
});
test('VIEW-05: Switching wording does not mutate the signal or its actionable status',()=>{
  const state={code:'LONG',actionable:true,reason:'source reason'};const original=structuredClone(state);
  beginnerGuidance(state);assert.deepEqual(state,original);
});
