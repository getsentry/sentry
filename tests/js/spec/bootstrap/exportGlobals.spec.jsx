import {getCleanStack} from 'app/bootstrap/exportGlobals';

/**
 * This should be temporary
 */
describe('exportGlobals', function () {
  it('scrubs any http hostnames', function () {
    expect(
      getCleanStack(`Error at get (https://s1.sentry-cdn.com/_static/dist/sentry/app.7831ef2f533f69df6c88.js:1:75508)
  at <anonymous>:22:20
  at <anonymous>:37:3`)
    ).toBe(
      `Error at get (/_static/dist/sentry/app.7831ef2f533f69df6c88.js:1:75508)
  at <anonymous>:22:20
  at <anonymous>:37:3`
    );

    expect(
      getCleanStack(`Error at get (http://s1.sentry-cdn.com/_static/dist/sentry/app.7831ef2f533f69df6c88.js:1:75508)
  at <anonymous>:22:20
  at <anonymous>:37:3`)
    ).toBe(`Error at get (/_static/dist/sentry/app.7831ef2f533f69df6c88.js:1:75508)
  at <anonymous>:22:20
  at <anonymous>:37:3`);
  });

  it('ignores single stack traces', function () {
    expect(
      getCleanStack('get@webpack-internal:///./app/bootstrap/exportGlobals.tsx:259:53')
    ).toBe(null);
  });

  it('ignores when accessed from a browser extension', function () {
    expect(
      getCleanStack(
        'Error at get (https://sentry.io/_static/dist/sentry/app.33ea1fef36e2625bd1b7.js:1:78763) at chrome-extension://gppongmhjkpfnbhagpmjfkannfbllamg/js/inject.js:25:30 at Array.reduce (<anonymous>) at chrome-extension://gppongmhjkpfnbhagpmjfkannfbllamg/js/inject.js:20:18'
      )
    ).toBe(null);
  });

  it('ignores when accessed from `papaparse`', function () {
    expect(
      getCleanStack(
        'Error at get (http://sentry.io/_static/dist/sentry/app.d90b66b3633145480691.js:1:78622) at Object.e (http://sentry.io/_static/dist/sentry/vendor.1773e9fe32bdfb905d54.js:2:1441549) at Object.../node_modules/papaparse/papaparse.min.js (http://sentry.io/_static/dist/sentry/vendor.1773e9fe32bdfb905d54.js:2:1456482) at n (http://sentry.io/_static/dist/sentry/runtime.eac5a039e1af7f397580.js:1:149)'
      )
    ).toBe(null);
  });

  it('ignores when accessed from puppeteer', function () {
    expect(
      getCleanStack(
        'Error at get (https://sentry.io/_static/dist/sentry/app.46cd9429804a08faf9dd.js:1:78622) at __puppeteer_evaluation_script__:18:25 at Array.map (<anonymous>) at __puppeteer_evaluation_script__:10:18'
      )
    ).toBe(null);
  });
});
