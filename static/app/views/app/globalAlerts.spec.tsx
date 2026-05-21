import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {GlobalAlertProvider, useGlobalAlerts} from 'sentry/views/app/globalAlerts';

jest.mock('sentry/utils/localStorage');

const mockGetItem = jest.mocked(localStorageWrapper.getItem);
const mockSetItem = jest.mocked(localStorageWrapper.setItem);

const wrapper = ({children}: {children: React.ReactNode}) => (
  <GlobalAlertProvider>{children}</GlobalAlertProvider>
);

describe('GlobalAlertProvider', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockGetItem.mockReturnValue(null);
  });

  describe('addAlert()', () => {
    it('adds alerts with unique keys', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({message: 'first', variant: 'danger'});
        result.current.addAlert({message: 'second', variant: 'info'});
      });

      expect(result.current.alerts).toHaveLength(2);
      expect(result.current.alerts[0]!.key).not.toBe(result.current.alerts[1]!.key);
    });

    it('drops duplicates when noDuplicates is set', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({
          id: 'unique-key',
          message: 'first',
          variant: 'danger',
          noDuplicates: true,
        });
        result.current.addAlert({
          id: 'unique-key',
          message: 'second',
          variant: 'danger',
          noDuplicates: true,
        });
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0]!.message).toBe('first');
    });

    it('drops alerts that have been muted', () => {
      const future = Math.floor(Date.now() / 1000) + 60;
      mockGetItem.mockReturnValue(JSON.stringify({'muted-id': future}));

      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({
          id: 'muted-id',
          message: 'should not appear',
          variant: 'danger',
        });
      });

      expect(result.current.alerts).toHaveLength(0);
    });

    it('ignores expired entries in the muted list', () => {
      const past = Math.floor(Date.now() / 1000) - 60;
      mockGetItem.mockReturnValue(JSON.stringify({'stale-mute': past}));

      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({
          id: 'stale-mute',
          message: 'should appear',
          variant: 'danger',
        });
      });

      expect(result.current.alerts).toHaveLength(1);
    });
  });

  describe('closeAlert()', () => {
    it('removes the matching alert', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({message: 'a', variant: 'danger'});
        result.current.addAlert({message: 'b', variant: 'danger'});
        result.current.addAlert({message: 'c', variant: 'danger'});
      });

      const middle = result.current.alerts[1]!;

      act(() => {
        result.current.closeAlert(middle);
      });

      expect(result.current.alerts).toHaveLength(2);
      expect(result.current.alerts.map(a => a.message)).toEqual(['a', 'c']);
    });

    it('persists muting for alerts with an id', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({
          id: 'persistent',
          message: 'persistent alert',
          variant: 'danger',
        });
      });

      const alert = result.current.alerts[0]!;

      act(() => {
        result.current.closeAlert(alert);
      });

      expect(mockSetItem).toHaveBeenCalledWith(
        'alerts:muted',
        expect.stringContaining('persistent')
      );

      const written = JSON.parse(mockSetItem.mock.calls.at(-1)![1]);
      expect(written.persistent).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('does not persist muting for alerts without an id', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({message: 'transient', variant: 'danger'});
      });

      const alert = result.current.alerts[0]!;

      act(() => {
        result.current.closeAlert(alert);
      });

      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe('expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('auto-removes transient alerts after the expiration delay', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({message: 'temp', variant: 'danger'});
      });
      expect(result.current.alerts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(result.current.alerts).toHaveLength(0);
    });

    it('does not auto-remove alerts with neverExpire', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({
          message: 'sticky',
          variant: 'danger',
          neverExpire: true,
        });
      });

      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(result.current.alerts).toHaveLength(1);
    });

    it('does not auto-expire alerts with an id by default', () => {
      const {result} = renderHook(useGlobalAlerts, {wrapper});

      act(() => {
        result.current.addAlert({
          id: 'persistent',
          message: 'sticky',
          variant: 'danger',
        });
      });

      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(result.current.alerts).toHaveLength(1);
    });
  });

  it('throws when used outside the provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(useGlobalAlerts)).toThrow(
      /useGlobalAlerts must be used within a GlobalAlertProvider/
    );
    consoleError.mockRestore();
  });
});
