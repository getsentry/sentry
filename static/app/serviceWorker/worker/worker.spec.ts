/**
 * Tests for the service worker notificationclick handler in worker.ts.
 *
 * worker.ts registers event listeners directly on `self` at module load time,
 * so we capture those listeners via a mock before importing the module.
 */

// We mock @sentry/browser before importing the module under test
jest.mock('@sentry/browser', () => ({
  startSpan: jest.fn((_options: unknown, callback: () => unknown) => callback()),
  metrics: {
    count: jest.fn(),
  },
}));

// Mock the clientConfig and initializeSentry dependencies that are unrelated to
// what we're testing.
jest.mock('sentry/serviceWorker/worker/clientConfig', () => ({
  fetchClientConfig: jest.fn(() => Promise.resolve({})),
}));

jest.mock('sentry/serviceWorker/worker/initializeSentry', () => ({
  initializeSentry: jest.fn(() => Promise.resolve()),
}));

describe('service worker notificationclick handler', () => {
  type Listener = (event: Record<string, unknown>) => void;
  const listeners: Record<string, Listener[]> = {};

  // Capture `clients` so we can provide our own mock.
  const mockClients = {
    matchAll: jest.fn().mockResolvedValue([]),
    openWindow: jest.fn().mockResolvedValue(undefined),
    claim: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    // Set up a minimal ServiceWorkerGlobalScope-like `self` that captures
    // event listeners before the module is imported.
    Object.defineProperty(global, 'self', {
      value: {
        addEventListener: (type: string, listener: Listener) => {
          listeners[type] = listeners[type] ?? [];
          listeners[type].push(listener);
        },
        skipWaiting: jest.fn().mockResolvedValue(undefined),
        clients: mockClients,
        location: new URL('https://sentry.io'),
        registration: {showNotification: jest.fn()},
      },
      writable: true,
      configurable: true,
    });

    // Import the module now that `self` is in place.

    require('sentry/serviceWorker/worker/worker');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function buildNotificationEvent(data: unknown) {
    const notification = {
      data,
      tag: 'test-tag',
      close: jest.fn(),
    };
    return {
      notification,
      waitUntil: (promise: Promise<unknown>) => promise,
    };
  }

  it('does not throw when notification data is null', async () => {
    const handler = listeners.notificationclick?.[0];
    expect(handler).toBeDefined();

    const event = buildNotificationEvent(null);
    // Before the fix, this threw: TypeError: Cannot use 'in' operator to search
    // for 'navigateTo' in null
    await expect(
      Promise.resolve().then(() => handler!(event as unknown as Record<string, unknown>))
    ).resolves.not.toThrow();
  });

  it('does not throw when notification data is undefined (property absent)', async () => {
    const handler = listeners.notificationclick?.[0];
    expect(handler).toBeDefined();

    const notification = {tag: 'test-tag', close: jest.fn()};
    const event = {notification, waitUntil: (p: Promise<unknown>) => p};
    await expect(
      Promise.resolve().then(() => handler!(event as unknown as Record<string, unknown>))
    ).resolves.not.toThrow();
  });

  it('navigates when notification data contains navigateTo', async () => {
    const handler = listeners.notificationclick?.[0];
    expect(handler).toBeDefined();

    mockClients.matchAll.mockResolvedValue([]);

    const event = buildNotificationEvent({navigateTo: {pathname: '/issues/', query: {}}});
    await handler!(event);

    expect(mockClients.openWindow).toHaveBeenCalledWith(
      expect.objectContaining({pathname: '/issues/'})
    );
  });
});
