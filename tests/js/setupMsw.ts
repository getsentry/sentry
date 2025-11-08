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
afterEach(() => {
  server.resetHandlers();
  server.use(
    // jest project under Sentry organization (dev productivity team)
    http.all('*3fe1dce93e3a4267979ebad67f3de327*', passthrough)
  );
});
afterAll(() => server.close());
