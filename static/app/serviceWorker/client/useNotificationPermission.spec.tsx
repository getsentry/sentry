import {act, renderHook} from 'sentry-test/reactTestingLibrary';

describe('useNotificationPermission', () => {
  const originalNotification = window.Notification;

  afterEach(() => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: originalNotification,
    });
  });

  function loadHook() {
    let mod!: typeof import('sentry/serviceWorker/client/useNotificationPermission');
    jest.isolateModules(() => {
      mod = require('sentry/serviceWorker/client/useNotificationPermission');
    });
    return mod.useNotificationPermission;
  }

  it('falls back to default when Notification is present but undefined', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect('Notification' in window).toBe(true);

    const useNotificationPermission = loadHook();
    const {result} = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe('default');
    expect(result.current.supportsNotifications).toBe(false);
    await act(async () => {
      await expect(result.current.askNotificationPermission()).rejects.toThrow(
        'Notifications are not supported'
      );
    });
  });

  it('reads Notification.permission when supported', () => {
    const MockNotification = Object.assign(jest.fn(), {
      permission: 'granted',
      requestPermission: jest.fn(),
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: MockNotification,
    });

    const useNotificationPermission = loadHook();
    const {result} = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe('granted');
    expect(result.current.supportsNotifications).toBe(true);
  });
});
