import * as Sentry from '@sentry/react';

let hub;

function init(dsn: string) {
  // This client is used to track all API requests that use `app/api`
  // This is a bit noisy so we don't want it in the main project (yet)
  const client = new Sentry.BrowserClient({
    dsn,
  });

  hub = new Sentry.Hub(client);
}

const run = cb => {
  if (!hub) {
    return;
  }

  hub.run(cb);
};

export {init, run};
