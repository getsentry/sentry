import {server} from 'sentry-test/msw';

beforeAll(() =>
  server.listen({
    // This tells MSW to throw an error whenever it
    // encounters a request that doesn't have a
    // matching request handler.
    onUnhandledRequest: 'error',
  })
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
