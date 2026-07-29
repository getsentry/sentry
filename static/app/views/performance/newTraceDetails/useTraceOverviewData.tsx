import {skipToken, useQuery} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
} from 'sentry/views/explore/logs/types';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {
  getTraceMetaLogsCount,
  getTraceMetaMetricsCount,
  type TraceMetaQueryResults,
} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceViewQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

type TraceDataAvailability = 'loading' | 'present' | 'absent' | 'unknown';

export interface TraceOverviewData {
  isProjectsLoading: boolean;
  isRepresentativeLoading: boolean;
  isTabLoading: boolean;
  logs: {
    availability: TraceDataAvailability;
    count: number | undefined;
    representative: EventsLogsResult['data'] | undefined;
  };
  metrics: {
    availability: TraceDataAvailability;
    count: number | undefined;
  };
  projectIds: string[] | undefined;
}

const LOGS_COUNT_FIELD = `${AggregationKey.COUNT}(${OurLogKnownFieldKey.MESSAGE})`;
const METRICS_COUNT_FIELD = `count(${TraceMetricKnownFieldKey.METRIC_NAME})`;
const STALE_TIME = 5 * 60 * 1000;

interface TraceCountResult {
  data: Array<Record<string, number>>;
}

interface TraceProjectResult {
  data: Array<{[TraceMetricKnownFieldKey.PROJECT_ID]?: number | string}>;
}

function getProjectIds(result: TraceProjectResult | undefined): string[] {
  return (
    result?.data.flatMap(row => {
      const projectId = row[TraceMetricKnownFieldKey.PROJECT_ID];
      return projectId === undefined ? [] : [String(projectId)];
    }) ?? []
  );
}

function getDateTimeQuery(queryParams: TraceViewQueryParams) {
  if (queryParams.timestamp) {
    const timestampMs = queryParams.timestamp * 1000;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return {
      start: new Date(timestampMs - oneDayMs).toISOString(),
      end: new Date(timestampMs + oneDayMs).toISOString(),
    };
  }

  if (queryParams.start && queryParams.end) {
    return {start: queryParams.start, end: queryParams.end};
  }

  return {statsPeriod: queryParams.statsPeriod ?? DEFAULT_STATS_PERIOD};
}

function getAvailability({
  enabled,
  metaCount,
  shouldFetchSupplementalData,
  supplementalCount,
  supplementalStatus,
}: {
  enabled: boolean;
  metaCount: number | undefined;
  shouldFetchSupplementalData: boolean;
  supplementalCount: number | undefined;
  supplementalStatus: 'error' | 'pending' | 'success';
}): TraceDataAvailability {
  if (!enabled) {
    return 'absent';
  }

  if (metaCount !== undefined) {
    return metaCount > 0 ? 'present' : 'absent';
  }

  if (!shouldFetchSupplementalData || supplementalStatus === 'error') {
    return 'unknown';
  }

  if (supplementalStatus === 'pending') {
    return 'loading';
  }

  return supplementalCount && supplementalCount > 0 ? 'present' : 'absent';
}

export function useTraceOverviewData({
  logsEnabled,
  meta,
  metricsEnabled,
  queryParams,
  traceSlug,
  tree,
}: {
  logsEnabled: boolean;
  meta: TraceMetaQueryResults['data'];
  metricsEnabled: boolean;
  queryParams: TraceViewQueryParams;
  traceSlug: string;
  tree: TraceTree;
}): TraceOverviewData {
  const organization = useOrganization();
  const logsMetaCount = getTraceMetaLogsCount(meta);
  const metricsMetaCount = getTraceMetaMetricsCount(meta);
  const shouldFetchLogsCount =
    logsEnabled && meta !== undefined && logsMetaCount === undefined;
  const shouldFetchMetricsCount =
    metricsEnabled && meta !== undefined && metricsMetaCount === undefined;
  const dateTimeQuery = getDateTimeQuery(queryParams);
  const projectQuery = {project: [String(ALL_ACCESS_PROJECTS)]};
  const traceSearch = new MutableSearch('');
  traceSearch.addFilterValue(OurLogKnownFieldKey.TRACE_ID, traceSlug);

  const logsCountResult = useQuery(
    apiOptions.as<TraceCountResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: shouldFetchLogsCount ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: DiscoverDatasets.OURLOGS,
        disableAggregateExtrapolation: '1',
        field: [LOGS_COUNT_FIELD],
        query: traceSearch.formatString(),
        referrer: 'api.trace-details.overview-logs-count',
        ...projectQuery,
        ...dateTimeQuery,
      },
      staleTime: STALE_TIME,
    })
  );

  const metricsSearch = new MutableSearch('');
  metricsSearch.addFilterValue(TraceMetricKnownFieldKey.TRACE, traceSlug);
  const metricsCountResult = useQuery(
    apiOptions.as<TraceCountResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: shouldFetchMetricsCount
        ? {organizationIdOrSlug: organization.slug}
        : skipToken,
      query: {
        dataset: DiscoverDatasets.TRACEMETRICS,
        disableAggregateExtrapolation: '1',
        field: [METRICS_COUNT_FIELD],
        query: metricsSearch.formatString(),
        referrer: 'api.trace-details.overview-metrics-count',
        ...projectQuery,
        ...dateTimeQuery,
      },
      staleTime: STALE_TIME,
    })
  );

  const logsSupplementalCount = logsCountResult.data?.data[0]?.[LOGS_COUNT_FIELD];
  const metricsSupplementalCount =
    metricsCountResult.data?.data[0]?.[METRICS_COUNT_FIELD];
  const logsAvailability = getAvailability({
    enabled: logsEnabled,
    metaCount: logsMetaCount,
    shouldFetchSupplementalData: shouldFetchLogsCount,
    supplementalCount: logsSupplementalCount,
    supplementalStatus: logsCountResult.status,
  });
  const metricsAvailability = getAvailability({
    enabled: metricsEnabled,
    metaCount: metricsMetaCount,
    shouldFetchSupplementalData: shouldFetchMetricsCount,
    supplementalCount: metricsSupplementalCount,
    supplementalStatus: metricsCountResult.status,
  });

  const logsCount = logsMetaCount ?? logsSupplementalCount;
  const metricsCount = metricsMetaCount ?? metricsSupplementalCount;
  const shouldFetchLogProjects =
    tree.type === 'empty' && logsAvailability === 'present' && (logsCount ?? 0) > 1;
  const logProjectsResult = useQuery(
    apiOptions.as<TraceProjectResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: shouldFetchLogProjects
        ? {organizationIdOrSlug: organization.slug}
        : skipToken,
      query: {
        dataset: DiscoverDatasets.OURLOGS,
        field: [OurLogKnownFieldKey.PROJECT_ID, LOGS_COUNT_FIELD],
        query: traceSearch.formatString(),
        per_page: 100,
        referrer: 'api.trace-details.overview-log-projects',
        ...projectQuery,
        ...dateTimeQuery,
      },
      staleTime: STALE_TIME,
    })
  );

  const shouldFetchMetricProjects =
    tree.type === 'empty' && metricsAvailability === 'present';
  const metricProjectsResult = useQuery(
    apiOptions.as<TraceProjectResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: shouldFetchMetricProjects
        ? {organizationIdOrSlug: organization.slug}
        : skipToken,
      query: {
        dataset: DiscoverDatasets.TRACEMETRICS,
        field: [TraceMetricKnownFieldKey.PROJECT_ID, METRICS_COUNT_FIELD],
        query: metricsSearch.formatString(),
        per_page: 100,
        referrer: 'api.trace-details.overview-metric-projects',
        ...projectQuery,
        ...dateTimeQuery,
      },
      staleTime: STALE_TIME,
    })
  );

  const shouldFetchRepresentativeLog =
    tree.type === 'empty' && logsAvailability === 'present';
  const representativeLogResult = useQuery(
    apiOptions.as<EventsLogsResult>()(
      '/organizations/$organizationIdOrSlug/trace-logs/',
      {
        path: shouldFetchRepresentativeLog
          ? {organizationIdOrSlug: organization.slug}
          : skipToken,
        query: {
          traceId: [traceSlug],
          field: [
            OurLogKnownFieldKey.ID,
            OurLogKnownFieldKey.PROJECT_ID,
            OurLogKnownFieldKey.TRACE_ID,
            OurLogKnownFieldKey.SEVERITY,
            OurLogKnownFieldKey.MESSAGE,
            OurLogKnownFieldKey.TIMESTAMP,
            OurLogKnownFieldKey.TIMESTAMP_PRECISE,
          ],
          orderby: '-timestamp',
          per_page: 1,
          referrer: 'api.trace-details.overview-representative-log',
          ...projectQuery,
          ...dateTimeQuery,
        },
        staleTime: STALE_TIME,
      }
    )
  );

  const representativeLogLoading =
    tree.type === 'empty' &&
    (logsAvailability === 'loading' ||
      (shouldFetchRepresentativeLog && representativeLogResult.status === 'pending'));
  const logProjectsLoading =
    shouldFetchLogProjects && logProjectsResult.status === 'pending';
  const metricProjectsLoading =
    shouldFetchMetricProjects && metricProjectsResult.status === 'pending';
  const projectAvailabilityLoading =
    tree.type === 'empty' &&
    (logsAvailability === 'loading' || metricsAvailability === 'loading');
  const summaryLoading =
    logsAvailability === 'loading' || metricsAvailability === 'loading';
  const isProjectsLoading =
    projectAvailabilityLoading ||
    representativeLogLoading ||
    logProjectsLoading ||
    metricProjectsLoading;
  const representativeLog = representativeLogResult.data?.data[0];
  const representativeProjectId = representativeLog?.[OurLogKnownFieldKey.PROJECT_ID];
  const projectIds = isProjectsLoading
    ? undefined
    : Array.from(
        new Set([
          ...getProjectIds(logProjectsResult.data),
          ...getProjectIds(metricProjectsResult.data),
          ...(representativeProjectId === undefined
            ? []
            : [String(representativeProjectId)]),
        ])
      );

  return {
    isProjectsLoading,
    isRepresentativeLoading: representativeLogLoading,
    isTabLoading: summaryLoading,
    projectIds,
    logs: {
      availability: logsAvailability,
      count: logsCount,
      representative: representativeLogResult.data?.data,
    },
    metrics: {
      availability: metricsAvailability,
      count: metricsCount,
    },
  };
}
