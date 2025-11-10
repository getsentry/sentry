import {http, passthrough} from 'msw';

import {server} from 'sentry-test/msw';

beforeAll(() =>
  server.listen({
    // This tells MSW to throw an error whenever it
    // encounters a request that doesn't have a
    // matching request handler.
    onUnhandledRequest: 'error',
  })
);

beforeEach(() => {
  server.use(
    // jest project under Sentry organization (dev productivity team)
    http.all('https://o1.ingest.us.sentry.io/*', () => {
      passthrough();
    })
  );
});

afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());
