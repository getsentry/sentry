import pick from 'lodash/pick';

import {initializeOrg} from 'sentry-test/initializeOrg';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {
  TraceMetricEventsResponseItem,
  TraceMetricEventsResult,
} from 'sentry/views/explore/metrics/types';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

function TraceMetricFixture({
  [TraceMetricKnownFieldKey.PROJECT_ID]: projectId,
  [TraceMetricKnownFieldKey.ORGANIZATION_ID]: organizationId,
  [TraceMetricKnownFieldKey.ID]: id,
  [TraceMetricKnownFieldKey.METRIC_NAME]: metricName = 'duration',
  [TraceMetricKnownFieldKey.METRIC_TYPE]: metricType = 'distribution',
  [TraceMetricKnownFieldKey.METRIC_VALUE]: metricValue = 100,
  [TraceMetricKnownFieldKey.METRIC_UNIT]: metricUnit = 'millisecond',
  [TraceMetricKnownFieldKey.TIMESTAMP]: timestamp = '2025-04-03T15:50:10+00:00',
  [TraceMetricKnownFieldKey.TRACE]: trace = '7b91699fd385d9fd52e0c4bc',
  [TraceMetricKnownFieldKey.SPAN_ID]: spanId = 'abc123def456',
  [TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise = 1.744312870049196e18,
  [TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]:
    observedTimestampPrecise = 1.744312870049196e18,
  ...rest
}: Partial<TraceMetricEventsResponseItem> &
  Required<
    Pick<
      TraceMetricEventsResponseItem,
      | TraceMetricKnownFieldKey.ID
      | TraceMetricKnownFieldKey.PROJECT_ID
      | TraceMetricKnownFieldKey.ORGANIZATION_ID
    >
  >): TraceMetricEventsResponseItem {
  const baseFields = {
    [TraceMetricKnownFieldKey.ID]: String(id),
    [TraceMetricKnownFieldKey.PROJECT_ID]: String(projectId),
    [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organizationId),
    [TraceMetricKnownFieldKey.METRIC_NAME]: metricName,
    [TraceMetricKnownFieldKey.METRIC_TYPE]: metricType,
    [TraceMetricKnownFieldKey.METRIC_VALUE]: metricValue,
    [TraceMetricKnownFieldKey.METRIC_UNIT]: metricUnit,
    [TraceMetricKnownFieldKey.TIMESTAMP]: timestamp,
    [TraceMetricKnownFieldKey.TRACE]: trace,
    [TraceMetricKnownFieldKey.SPAN_ID]: spanId,
    [TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise,
    [TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: observedTimestampPrecise,
  };

  return {
    ...baseFields,
    ...rest,
  } as TraceMetricEventsResponseItem;
}

// Incomplete, only provides type of field if it's a string or number.
function TraceMetricFixtureMeta(
  fixture: TraceMetricEventsResponseItem | TraceMetricEventsResponseItem[]
): EventsMetaType {
  const metricFixtures = Array.isArray(fixture) ? fixture : [fixture];
  const fields = metricFixtures.flatMap(metricFixture =>
    Object.entries(metricFixture).map(([key, value]) => {
      const valueType = typeof value;
      if (!['string', 'number'].includes(valueType)) {
        throw new Error(`Invalid value type: ${valueType}`);
      }
      return [key, valueType];
    })
  );
  return {
    fields: Object.fromEntries(fields),
    units: {},
    dataScanned: 'full',
  };
}

interface TraceMetricsTestInitOptions {
  isProjectOnboarded?: boolean;
  liveRefresh?: boolean;
  orgFeatures?: string[];
  organization?: Partial<Organization>;
  pageFiltersPeriod?: string;
  project?: Partial<Project>;
  refreshInterval?: string;
  routerQuery?: Record<string, any>;
  tracemetrics?: boolean;
}

// Narrowed type from sentry-test/reactTestingLibrary.tsx
type LocationConfig = {
  pathname: string;
  query?: Record<string, string | number | string[]>;
};

/**
 * Standardized initialization for trace metrics tests
 */
export function initializeTraceMetricsTest({
  orgFeatures = [],
  organization: orgOverrides = {},
  project: projectOverrides,
  tracemetrics = true,
  routerQuery = {},
  refreshInterval = '60', // Fast refresh for testing, should always exceed waitFor internal timer interval (50ms default)
}: TraceMetricsTestInitOptions = {}): {
  generateRouterConfig: (routerQueryOverrides: Record<string, any>) => {
    location: LocationConfig;
    route?: string;
  };
  initialLocation: LocationConfig;
  initialPageFilters: PageFilters;
  organization: Organization;
  project: Project;
  routerConfig: {
    location: LocationConfig;
    route?: string;
  };
  setupEventsMock: (
    metricFixtures: TraceMetricEventsResponseItem[],
    match?: Parameters<typeof MockApiClient.addMockResponse>[0]['match']
  ) => jest.Mock;
  setupPageFilters: () => void;
  setupTraceItemsMock: (metricFixtures: TraceMetricEventsResponseItem[]) => jest.Mock[];
} {
  const baseFeatures = tracemetrics ? ['tracemetrics-enabled'] : [];

  const forcedProject = projectOverrides ?? {hasTraceMetrics: true};
  const {organization, project} = initializeOrg({
    organization: {
      features: [...baseFeatures, ...orgFeatures],
      ...orgOverrides,
    },
    projects: [forcedProject],
  });

  const initialLocation: LocationConfig = {
    pathname: `/organizations/${organization.slug}/explore/metrics/`,
    query: {
      refreshInterval, // Fast refresh for testing, should always exceed waitFor internal timer interval (50ms default)
      ...routerQuery,
    },
  };

  const routerConfig: {
    location: LocationConfig;
    route?: string;
  } = {
    location: initialLocation,
    route: '/organizations/:orgId/explore/metrics/',
  };

  const initialPageFilters: PageFilters = {
    projects: [parseInt(project.id, 10)],
    environments: [],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: null,
    },
  };

  const generateRouterConfig = (routerQueryOverrides: Record<string, string>) => {
    return {
      location: {
        ...initialLocation,
        query: {
          ...initialLocation.query,
          ...routerQueryOverrides,
        },
      },
    };
  };

  const setupPageFilters = () => {
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(initialPageFilters);
  };

  const setupEventsMock = (
    metricFixtures: TraceMetricEventsResponseItem[],
    match?: Parameters<typeof MockApiClient.addMockResponse>[0]['match']
  ) => {
    const eventsData: TraceMetricEventsResult = {
      data: metricFixtures,
      meta: TraceMetricFixtureMeta(metricFixtures),
    };

    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: eventsData,
      match,
    });
  };

  const setupTraceItemsMock = (metricFixtures: TraceMetricEventsResponseItem[]) => {
    return metricFixtures.map(metricFixture => {
      const attributes: TraceItemResponseAttribute[] = Object.entries(metricFixture).map(
        ([k, v]) => {
          if (typeof v === 'string') {
            return {name: k, value: v, type: 'str' as const};
          }
          return {name: k, value: Number(v), type: 'float' as const};
        }
      );

      return MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/trace-items/${metricFixture[TraceMetricKnownFieldKey.ID]}/`,
        method: 'GET',
        body: {
          itemId: metricFixture[TraceMetricKnownFieldKey.ID],
          links: null,
          meta: TraceMetricFixtureMeta(metricFixture),
          timestamp: metricFixture[TraceMetricKnownFieldKey.TIMESTAMP],
          attributes,
        },
      });
    });
  };

  return {
    organization,
    project,
    routerConfig,
    initialPageFilters,
    initialLocation,
    generateRouterConfig,
    setupPageFilters,
    setupEventsMock,
    setupTraceItemsMock,
  };
}

/**
 * Standard set of trace metric fixtures for testing - can be sliced as needed
 * Creates metrics in descending timestamp order (newest first)
 * Returns both base fixtures (minimal fields) and detailed fixtures (all fields)
 */
export function createTraceMetricFixtures(
  organization: Organization,
  project: Project,
  nowDate: Date,
  options: {
    baseFields?: string[];
    intervalMs?: number;
  } = {}
): {
  baseFixtures: TraceMetricEventsResponseItem[];
  detailedFixtures: TraceMetricEventsResponseItem[];
} {
  const {intervalMs = 1000} = options;
  const nowTimestamp = nowDate.getTime();

  // Default base fields - minimal fields for basic testing
  const defaultBaseFields = [
    TraceMetricKnownFieldKey.ID,
    TraceMetricKnownFieldKey.PROJECT_ID,
    TraceMetricKnownFieldKey.ORGANIZATION_ID,
    TraceMetricKnownFieldKey.METRIC_NAME,
    TraceMetricKnownFieldKey.METRIC_TYPE,
    TraceMetricKnownFieldKey.METRIC_VALUE,
    TraceMetricKnownFieldKey.TIMESTAMP,
    TraceMetricKnownFieldKey.TRACE,
  ];

  const baseFieldKeys = options.baseFields || defaultBaseFields;

  const metricData: Array<Partial<Record<TraceMetricKnownFieldKey, string | number>>> = [
    {
      [TraceMetricKnownFieldKey.ID]: '1',
      [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
      [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [TraceMetricKnownFieldKey.METRIC_NAME]: 'bar',
      [TraceMetricKnownFieldKey.METRIC_TYPE]: 'distribution',
      [TraceMetricKnownFieldKey.METRIC_VALUE]: 150,
      [TraceMetricKnownFieldKey.METRIC_UNIT]: 'millisecond',
      [TraceMetricKnownFieldKey.TRACE]: '7b91699fd385d9fd52e0c4bc',
      [TraceMetricKnownFieldKey.SPAN_ID]: 'abc123def456',
      [TraceMetricKnownFieldKey.RELEASE]: '1.0.0',
      [TraceMetricKnownFieldKey.SDK_NAME]: 'sentry.python',
      [TraceMetricKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [TraceMetricKnownFieldKey.ID]: '2',
      [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
      [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [TraceMetricKnownFieldKey.METRIC_NAME]: 'foo',
      [TraceMetricKnownFieldKey.METRIC_TYPE]: 'distribution',
      [TraceMetricKnownFieldKey.METRIC_VALUE]: 150,
      [TraceMetricKnownFieldKey.METRIC_UNIT]: 'millisecond',
      [TraceMetricKnownFieldKey.TRACE]: '7b91699fd385d9fd52e0c4bc',
      [TraceMetricKnownFieldKey.SPAN_ID]: 'abc123def456',
      [TraceMetricKnownFieldKey.RELEASE]: '1.0.0',
      [TraceMetricKnownFieldKey.SDK_NAME]: 'sentry.python',
      [TraceMetricKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [TraceMetricKnownFieldKey.ID]: '3',
      [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
      [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [TraceMetricKnownFieldKey.METRIC_NAME]: 'response_size',
      [TraceMetricKnownFieldKey.METRIC_TYPE]: 'bar',
      [TraceMetricKnownFieldKey.METRIC_VALUE]: 2048,
      [TraceMetricKnownFieldKey.METRIC_UNIT]: 'byte',
      [TraceMetricKnownFieldKey.TRACE]: '8c92799fe496e0ee63f1d5cd',
      [TraceMetricKnownFieldKey.SPAN_ID]: 'def456ghi789',
      [TraceMetricKnownFieldKey.RELEASE]: '1.0.0',
      [TraceMetricKnownFieldKey.SDK_NAME]: 'sentry.python',
      [TraceMetricKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [TraceMetricKnownFieldKey.ID]: '4',
      [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
      [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [TraceMetricKnownFieldKey.METRIC_NAME]: 'request_count',
      [TraceMetricKnownFieldKey.METRIC_TYPE]: 'baz',
      [TraceMetricKnownFieldKey.METRIC_VALUE]: 1,
      [TraceMetricKnownFieldKey.METRIC_UNIT]: 'none',
      [TraceMetricKnownFieldKey.TRACE]: '9d03800gf5a7f1ff74g2e6de',
      [TraceMetricKnownFieldKey.SPAN_ID]: 'ghi789jkl012',
      [TraceMetricKnownFieldKey.RELEASE]: '1.0.1',
      [TraceMetricKnownFieldKey.SDK_NAME]: 'sentry.python',
      [TraceMetricKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [TraceMetricKnownFieldKey.ID]: '5',
      [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
      [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [TraceMetricKnownFieldKey.METRIC_NAME]: 'memory_usage',
      [TraceMetricKnownFieldKey.METRIC_TYPE]: 'gauge',
      [TraceMetricKnownFieldKey.METRIC_VALUE]: 512,
      [TraceMetricKnownFieldKey.METRIC_UNIT]: 'megabyte',
      [TraceMetricKnownFieldKey.TRACE]: 'ae14911hg6b8g2gg85h3f7ef',
      [TraceMetricKnownFieldKey.SPAN_ID]: 'jkl012mno345',
      [TraceMetricKnownFieldKey.RELEASE]: '1.0.1',
      [TraceMetricKnownFieldKey.SDK_NAME]: 'sentry.python',
      [TraceMetricKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [TraceMetricKnownFieldKey.ID]: '6',
      [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
      [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [TraceMetricKnownFieldKey.METRIC_NAME]: 'error_rate',
      [TraceMetricKnownFieldKey.METRIC_TYPE]: 'distribution',
      [TraceMetricKnownFieldKey.METRIC_VALUE]: 0.05,
      [TraceMetricKnownFieldKey.METRIC_UNIT]: 'ratio',
      [TraceMetricKnownFieldKey.TRACE]: 'bf25022ih7c9h3hh96i4g8fg',
      [TraceMetricKnownFieldKey.SPAN_ID]: 'mno345pqr678',
      [TraceMetricKnownFieldKey.RELEASE]: '1.0.1',
      [TraceMetricKnownFieldKey.SDK_NAME]: 'sentry.python',
      [TraceMetricKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
  ];

  const fixtures = metricData.map((data, index) => {
    const metricTimestamp = nowTimestamp - index * intervalMs;
    const completeMetricData = {
      ...data,
      [TraceMetricKnownFieldKey.TIMESTAMP]: new Date(metricTimestamp).toISOString(),
      [TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]: String(
        BigInt(metricTimestamp) * 1_000_000n
      ),
    };
    return completeMetricData;
  });

  // Used for /events mock
  const baseFixtures = fixtures.map(completeMetricData => {
    const baseOnlyFields = pick(completeMetricData, baseFieldKeys);
    return TraceMetricFixture(baseOnlyFields as any);
  });

  // Used for /trace-items mock
  const detailedFixtures = fixtures.map(completeMetricData => {
    return TraceMetricFixture(completeMetricData as any);
  });

  return {
    baseFixtures,
    detailedFixtures,
  };
}
