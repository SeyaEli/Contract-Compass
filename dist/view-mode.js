export const readViewMode=value=>value==='beginner'?'beginner':'current';

// Presentation only: this module cannot change the underlying trading signal.
export function beginnerGuidance(state) {
  switch(state?.code){
    case 'LONG': return {
      title:'Possible Buy / Long setup',
      explanation:'A long trade aims to gain when the price rises and loses when it falls. The app’s checks currently agree on this direction.',
      next:'This is not a promise of profit. First review where you would exit, the fees, and how much you could lose. Practice without real money if you are still learning.'
    };
    case 'SHORT': return {
      title:'Possible Sell / Short setup',
      explanation:'A short trade aims to gain when the price falls and loses when it rises. The app’s checks currently agree on this direction.',
      next:'This is not a promise of profit. First review where you would exit, the fees, and how much you could lose. Practice without real money if you are still learning.'
    };
    case 'WATCH_LONG': return {
      title:'Wait — a buy setup is not ready',
      explanation:'The overall price trend is upward, but the other checks have not agreed. This is not a buy or entry signal.',
      next:'Keep watching. Wait until all of the app’s entry checks agree before considering a buy.'
    };
    case 'WATCH_SHORT': return {
      title:'Wait — a sell setup is not ready',
      explanation:'The overall price trend is downward, but the other checks have not agreed. This is not a sell or entry signal.',
      next:'Keep watching. Wait until all of the app’s entry checks agree before considering a short trade.'
    };
    case 'WAIT': return {
      title:'Wait — no clear setup yet',
      explanation:'The checks do not agree, or the price has moved away from a previous setup. There is no confirmed entry right now.',
      next:'Waiting is an option. You do not need to trade every price move.'
    };
    default: return {
      title:'Not ready — wait for fresh data',
      explanation:'The app cannot confirm an entry right now. It may be updating, paused, or waiting for a connection.',
      next:'Check that live updates are on and your internet connection is working. Do not use old prices as a new entry signal.'
    };
  }
}
