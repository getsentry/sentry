import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {
  EAPTraceMeta,
  TraceMeta,
} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {useTraceOverviewData} from './useTraceOverviewData';

const TRACE_SLUG = '00000000000000000000000000000000';
const QUERY_PARAMS = {
  end: undefined,
  start: undefined,
  statsPeriod: '14d',
  timestamp: undefined,
};

const LEGACY_META: TraceMeta = {
  errors: 0,
  performance_issues: 0,
  projects: 0,
  span_count: 0,
  span_count_map: {},
  transaction_child_count_map: {},
  transactions: 0,
};

function makeEmptyTree(): TraceTree {
  return {type: 'empty'} as TraceTree;
}

function makeTraceTree(): TraceTree {
  return {type: 'trace'} as TraceTree;
}

function makeEapMeta(overrides: Partial<EAPTraceMeta> = {}): EAPTraceMeta {
  return {
    errorsCount: 0,
    logsCount: 0,
    metricsCount: 0,
    performanceIssuesCount: 0,
    spansCount: 0,
    spansCountMap: {},
    transactionChildCountMap: {},
    uptimeCount: 0,
    ...overrides,
  };
}

describe('useTraceOverviewData', () => {
  it('uses EAP metadata without supplemental requests', () => {
    const organization = OrganizationFixture();
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
    const traceLogsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {data: []},
    });

    const {result} = renderHookWithProviders(
      () =>
        useTraceOverviewData({
          logsEnabled: true,
          meta: makeEapMeta({logsCount: 2, metricsCount: 3}),
          metricsEnabled: true,
          queryParams: QUERY_PARAMS,
          traceSlug: TRACE_SLUG,
          tree: makeTraceTree(),
        }),
      {organization}
    );

    expect(result.current).toEqual({
      isRepresentativeLoading: false,
      isTabLoading: false,
      logs: {
        availability: 'present',
        count: 2,
        representative: undefined,
      },
      metrics: {
        availability: 'present',
        count: 3,
      },
    });
    expect(eventsRequest).not.toHaveBeenCalled();
    expect(traceLogsRequest).not.toHaveBeenCalled();
  });

  it('loads legacy counts and one representative log for a log-only trace', async () => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({dataset: 'ourlogs'})],
      body: {data: [{'count(message)': 4}]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({dataset: 'tracemetrics'})],
      body: {data: [{'count(metric.name)': 0}]},
    });
    const representativeLog = {
      [OurLogKnownFieldKey.ID]: 'log-id',
      [OurLogKnownFieldKey.MESSAGE]: 'Representative log message',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.SEVERITY]: 'info',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
      [OurLogKnownFieldKey.TIMESTAMP]: new Date().toISOString(),
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1',
      [OurLogKnownFieldKey.TRACE_ID]: TRACE_SLUG,
    };
    const traceLogsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {data: [representativeLog]},
    });

    const {result} = renderHookWithProviders(
      () =>
        useTraceOverviewData({
          logsEnabled: true,
          meta: LEGACY_META,
          metricsEnabled: true,
          queryParams: QUERY_PARAMS,
          traceSlug: TRACE_SLUG,
          tree: makeEmptyTree(),
        }),
      {organization}
    );

    expect(result.current.isTabLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isRepresentativeLoading).toBe(false);
      expect(result.current.isTabLoading).toBe(false);
    });

    expect(result.current.logs).toEqual({
      availability: 'present',
      count: 4,
      representative: representativeLog,
    });
    expect(result.current.metrics).toEqual({
      availability: 'absent',
      count: 0,
    });
    expect(traceLogsRequest).toHaveBeenCalledTimes(1);
    expect(traceLogsRequest.mock.calls[0]?.[1]?.query).toEqual(
      expect.objectContaining({per_page: 1, traceId: [TRACE_SLUG]})
    );
  });
});
