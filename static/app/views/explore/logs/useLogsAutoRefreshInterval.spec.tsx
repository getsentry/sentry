import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS,
  LOGS_AUTO_REFRESH_KEY,
  LOGS_REFRESH_INTERVAL_KEY,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useLogsAutoRefreshInterval} from 'sentry/views/explore/logs/useLogsAutoRefreshInterval';

type TestComponentProps = Parameters<typeof useLogsAutoRefreshInterval>[0];

function TestComponent(props: Omit<TestComponentProps, 'enabled'>) {
  const [enabled, setEnabled] = useState(true);
  useLogsAutoRefreshInterval({...props, enabled});

  return (
    <div>
      <button onClick={() => setEnabled(false)}>Disable</button>
      <button onClick={() => setEnabled(true)}>Enable</button>
    </div>
  );
}

describe('useLogsAutoRefreshInterval', () => {
  const organization = OrganizationFixture();
  const refreshInterval = 60 * 1000;

  function renderTestComponent(props: Omit<TestComponentProps, 'enabled'>) {
    const children = (
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <TestComponent {...props} />
      </LogsQueryParamsProvider>
    );

    const result = render(children, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/explore/logs/',
          query: {
            [LOGS_AUTO_REFRESH_KEY]: 'enabled',
            [LOGS_REFRESH_INTERVAL_KEY]: refreshInterval,
          },
        },
      },
    });

    return result;
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('preserves the absolute timeout while temporarily disabled', async () => {
    const fetchPreviousPage = jest.fn(() => false as const);
    const {router} = renderTestComponent({fetchPreviousPage, isError: false});
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

    await act(() => jest.advanceTimersByTimeAsync(ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS / 2));

    await user.click(screen.getByRole('button', {name: 'Disable'}));
    await user.click(screen.getByRole('button', {name: 'Enable'}));

    await act(() =>
      jest.advanceTimersByTimeAsync(
        ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS / 2 + refreshInterval
      )
    );

    await waitFor(() => {
      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('timeout');
    });
  });

  it('does not start another request when re-enabled during an active request', async () => {
    const fetchPreviousPage = jest.fn(() => new Promise<never>(() => {}));
    renderTestComponent({fetchPreviousPage, isError: false});
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

    expect(fetchPreviousPage).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', {name: 'Disable'}));
    await user.click(screen.getByRole('button', {name: 'Enable'}));

    expect(fetchPreviousPage).toHaveBeenCalledTimes(1);
  });
});
