/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

// EXPERIMENT: run Jest against React's production build to measure what the
// development build costs. Production React has no `act()`, which React Testing
// Library calls around every render and event, so approximate it: run the
// callback inside `flushSync` so renders and sync-lane effects commit
// immediately, then drain pending microtasks for async callbacks.
// Mapped to react/cjs/react.production.js in jest.config.ts (React's `exports`
// hides the cjs/ subpath from a plain require).
const React = require('react-production-build');

let ReactDOM = null;

async function drainMicrotasks() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function flush() {
  ReactDOM ??= require('react-dom');
  ReactDOM.flushSync(() => {});
}

function act(callback) {
  ReactDOM ??= require('react-dom');
  let result = null;
  ReactDOM.flushSync(() => {
    result = callback();
  });
  if (result && typeof result.then === 'function') {
    return result.then(async value => {
      await drainMicrotasks();
      flush();
      return value;
    });
  }
  return {
    then(resolve, reject) {
      drainMicrotasks()
        .then(() => {
          flush();
          resolve(result);
        })
        .catch(reject);
    },
  };
}

module.exports = {...React, act};
