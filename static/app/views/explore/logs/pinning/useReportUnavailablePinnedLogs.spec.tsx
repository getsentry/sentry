import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useReportUnavailablePinnedLogs} from 'sentry/views/explore/logs/pinning/useReportUnavailablePinnedLogs';
import type {usePinnedLogsQuery} from 'sentry/views/explore/logs/pinning/usePinnedLogsQuery';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';

type StatusById = ReturnType<typeof usePinnedLogsQuery>['statusById'];

const organization = OrganizationFixture({
  features: ['ourlogs-enabled', 'ourlogs-pinning'],
});

function makeRow(id: string): OurLogsResponseItem {
  return LogFixture({
    [OurLogKnownFieldKey.ID]: id,
    [OurLogKnownFieldKey.PROJECT_ID]: '1',
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
    [OurLogKnownFieldKey.MESSAGE]: `log ${id}`,
  });
}

function renderReportHook(props: {
  pinnedRows: string[];
  rowById: Map<string, OurLogsResponseItem>;
  statusById: StatusById;
}) {
  return renderHookWithProviders(useReportUnavailablePinnedLogs, {
    organization,
    initialProps: props,
    additionalWrapper: ({children}) => (
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        {children}
      </LogsQueryParamsProvider>
    ),
  });
}

describe('useReportUnavailablePinnedLogs', () => {
  it('tracks an event when a pinned row settles as not found', () => {
    const trackSpy = jest.spyOn(analytics, 'trackAnalytics');

    renderReportHook({
      pinnedRows: ['missing-log'],
      rowById: new Map(),
      statusById: new Map([['missing-log', 'success']]),
    });

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith('logs.table.pinned_row_unavailable', {
      log_id: 'missing-log',
      organization,
      page_source: LogsAnalyticsPageSource.EXPLORE_LOGS,
      reason: 'not_found',
    });
  });

  it('tracks an error event when a pinned row fails to load', () => {
    const trackSpy = jest.spyOn(analytics, 'trackAnalytics');

    renderReportHook({
      pinnedRows: ['broken-log'],
      rowById: new Map(),
      statusById: new Map([['broken-log', 'error']]),
    });

    expect(trackSpy).toHaveBeenCalledWith('logs.table.pinned_row_unavailable', {
      log_id: 'broken-log',
      organization,
      page_source: LogsAnalyticsPageSource.EXPLORE_LOGS,
      reason: 'error',
    });
  });

  it('does not track while a pinned row is still pending', () => {
    const trackSpy = jest.spyOn(analytics, 'trackAnalytics');

    renderReportHook({
      pinnedRows: ['pending-log'],
      rowById: new Map(),
      statusById: new Map([['pending-log', 'pending']]),
    });

    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('does not track when the pinned row is present in the fetched rows', () => {
    const trackSpy = jest.spyOn(analytics, 'trackAnalytics');

    renderReportHook({
      pinnedRows: ['found-log'],
      rowById: new Map([['found-log', makeRow('found-log')]]),
      statusById: new Map([['found-log', 'success']]),
    });

    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('reports each unavailable row only once across rerenders', () => {
    const trackSpy = jest.spyOn(analytics, 'trackAnalytics');

    const {rerender} = renderReportHook({
      pinnedRows: ['missing-log'],
      rowById: new Map(),
      statusById: new Map([['missing-log', 'success']]),
    });

    rerender({
      pinnedRows: ['missing-log'],
      rowById: new Map(),
      statusById: new Map([['missing-log', 'success']]),
    });

    expect(trackSpy).toHaveBeenCalledTimes(1);
  });

  it('reports a row again when its resolution reason changes', () => {
    const trackSpy = jest.spyOn(analytics, 'trackAnalytics');

    const {rerender} = renderReportHook({
      pinnedRows: ['flaky-log'],
      rowById: new Map(),
      statusById: new Map([['flaky-log', 'error']]),
    });

    rerender({
      pinnedRows: ['flaky-log'],
      rowById: new Map(),
      statusById: new Map([['flaky-log', 'success']]),
    });

    expect(trackSpy).toHaveBeenCalledTimes(2);
    expect(trackSpy).toHaveBeenNthCalledWith(
      1,
      'logs.table.pinned_row_unavailable',
      expect.objectContaining({log_id: 'flaky-log', reason: 'error'})
    );
    expect(trackSpy).toHaveBeenNthCalledWith(
      2,
      'logs.table.pinned_row_unavailable',
      expect.objectContaining({log_id: 'flaky-log', reason: 'not_found'})
    );
  });
});
