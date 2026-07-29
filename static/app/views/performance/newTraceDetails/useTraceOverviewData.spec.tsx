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
      isProjectsLoading: false,
      isRepresentativeLoading: false,
      isTabLoading: false,
      projectIds: [],
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

  it('loads project ids and one representative log for an EAP log-only trace', async () => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          dataset: 'ourlogs',
          field: ['project.id', 'count(message)'],
        }),
      ],
      body: {
        data: [
          {'project.id': 1, 'count(message)': 1},
          {'project.id': 2, 'count(message)': 1},
        ],
      },
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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {data: [representativeLog]},
    });

    const {result} = renderHookWithProviders(
      () =>
        useTraceOverviewData({
          logsEnabled: true,
          meta: makeEapMeta({logsCount: 2}),
          metricsEnabled: true,
          queryParams: QUERY_PARAMS,
          traceSlug: TRACE_SLUG,
          tree: makeEmptyTree(),
        }),
      {organization}
    );

    expect(result.current.isProjectsLoading).toBe(true);
    expect(result.current.projectIds).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isProjectsLoading).toBe(false);
    });

    expect(result.current.projectIds).toEqual(['1', '2']);
    expect(result.current.logs).toEqual({
      availability: 'present',
      count: 2,
      representative: [representativeLog],
    });
  });

  it('loads project ids for an EAP metric-only trace', async () => {
    const organization = OrganizationFixture();
    const metricProjectsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          field: ['project.id', 'count(metric.name)'],
        }),
      ],
      body: {
        data: [
          {'project.id': 2, 'count(metric.name)': 1},
          {'project.id': 3, 'count(metric.name)': 1},
        ],
      },
    });
    const traceLogsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {data: []},
    });

    const {result} = renderHookWithProviders(
      () =>
        useTraceOverviewData({
          logsEnabled: true,
          meta: makeEapMeta({metricsCount: 2}),
          metricsEnabled: true,
          queryParams: QUERY_PARAMS,
          traceSlug: TRACE_SLUG,
          tree: makeEmptyTree(),
        }),
      {organization}
    );

    expect(result.current.isProjectsLoading).toBe(true);
    expect(result.current.projectIds).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isProjectsLoading).toBe(false);
    });

    expect(result.current.projectIds).toEqual(['2', '3']);
    expect(result.current.metrics).toEqual({
      availability: 'present',
      count: 2,
    });
    expect(metricProjectsRequest.mock.calls[0]?.[1]?.query).toEqual(
      expect.objectContaining({
        field: ['project.id', 'count(metric.name)'],
        per_page: 100,
        project: ['-1'],
      })
    );
    expect(traceLogsRequest).not.toHaveBeenCalled();
  });

  it('combines log and metric project ids for an EAP trace', async () => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          dataset: 'ourlogs',
          field: ['project.id', 'count(message)'],
        }),
      ],
      body: {
        data: [
          {'project.id': 1, 'count(message)': 1},
          {'project.id': 2, 'count(message)': 1},
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          field: ['project.id', 'count(metric.name)'],
        }),
      ],
      body: {
        data: [
          {'project.id': 2, 'count(metric.name)': 1},
          {'project.id': 3, 'count(metric.name)': 1},
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [
          {
            [OurLogKnownFieldKey.ID]: 'log-id',
            [OurLogKnownFieldKey.PROJECT_ID]: '1',
          },
        ],
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useTraceOverviewData({
          logsEnabled: true,
          meta: makeEapMeta({logsCount: 2, metricsCount: 2}),
          metricsEnabled: true,
          queryParams: QUERY_PARAMS,
          traceSlug: TRACE_SLUG,
          tree: makeEmptyTree(),
        }),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isProjectsLoading).toBe(false);
    });

    expect(result.current.projectIds).toEqual(['1', '2', '3']);
  });

  it('loads legacy counts and one representative log for a log-only trace', async () => {
    const organization = OrganizationFixture();
    const logsCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({dataset: 'ourlogs', field: ['count(message)']})],
      body: {data: [{'count(message)': 4}]},
    });
    const logProjectsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          dataset: 'ourlogs',
          field: ['project.id', 'count(message)'],
        }),
      ],
      body: {
        data: [
          {'project.id': 1, 'count(message)': 2},
          {'project.id': 2, 'count(message)': 2},
        ],
      },
    });
    const metricsCountRequest = MockApiClient.addMockResponse({
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
    expect(result.current.isProjectsLoading).toBe(true);
    expect(result.current.isRepresentativeLoading).toBe(true);
    expect(result.current.projectIds).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isProjectsLoading).toBe(false);
      expect(result.current.isRepresentativeLoading).toBe(false);
      expect(result.current.isTabLoading).toBe(false);
    });

    expect(result.current.projectIds).toEqual(['1', '2']);
    expect(result.current.logs).toEqual({
      availability: 'present',
      count: 4,
      representative: [representativeLog],
    });
    expect(result.current.metrics).toEqual({
      availability: 'absent',
      count: 0,
    });
    expect(logsCountRequest.mock.calls[0]?.[1]?.query).toEqual(
      expect.objectContaining({
        disableAggregateExtrapolation: '1',
        project: ['-1'],
      })
    );
    expect(metricsCountRequest.mock.calls[0]?.[1]?.query).toEqual(
      expect.objectContaining({
        disableAggregateExtrapolation: '1',
        project: ['-1'],
      })
    );
    expect(traceLogsRequest).toHaveBeenCalledTimes(1);
    expect(traceLogsRequest.mock.calls[0]?.[1]?.query).toEqual(
      expect.objectContaining({
        orderby: '-timestamp',
        per_page: 1,
        project: ['-1'],
        traceId: [TRACE_SLUG],
      })
    );
    expect(logProjectsRequest).toHaveBeenCalledTimes(1);
    expect(logProjectsRequest.mock.calls[0]?.[1]?.query).toEqual(
      expect.objectContaining({
        field: ['project.id', 'count(message)'],
        per_page: 100,
        project: ['-1'],
      })
    );
  });
});
