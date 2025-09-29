import pick from 'lodash/pick';

import {initializeOrg} from 'sentry-test/initializeOrg';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {
  EventsMetricsResult,
  MetricsResponseItem,
} from 'sentry/views/explore/metrics/types';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

export function MetricFixture({
  [TraceMetricKnownFieldKey.PROJECT_ID]: projectId,
  [TraceMetricKnownFieldKey.ORGANIZATION_ID]: organizationId,
  [TraceMetricKnownFieldKey.ID]: id,
  [TraceMetricKnownFieldKey.METRIC_NAME]: metricName = 'test.metric',
  [TraceMetricKnownFieldKey.METRIC_TYPE]: metricType = 'count',
  [TraceMetricKnownFieldKey.METRIC_VALUE]: metricValue = 100,
  [TraceMetricKnownFieldKey.TIMESTAMP]: timestamp = '2025-04-03T15:50:10+00:00',
  [TraceMetricKnownFieldKey.TRACE_ID]: traceId = '7b91699fd385d9fd52e0c4bc',
  [TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise = 1.744312870049196e18,
  [TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]:
    observedTimestampPrecise = 1.744312870049196e18,
  ...rest
}: Partial<MetricsResponseItem> &
  Required<
    Pick<
      MetricsResponseItem,
      | TraceMetricKnownFieldKey.ID
      | TraceMetricKnownFieldKey.PROJECT_ID
      | TraceMetricKnownFieldKey.ORGANIZATION_ID
    >
  >): MetricsResponseItem {
  return {
    [TraceMetricKnownFieldKey.ID]: String(id),
    [TraceMetricKnownFieldKey.PROJECT_ID]: String(projectId),
    [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organizationId),
    [TraceMetricKnownFieldKey.METRIC_NAME]: metricName,
    [TraceMetricKnownFieldKey.METRIC_TYPE]: metricType,
    [TraceMetricKnownFieldKey.METRIC_VALUE]: metricValue,
    [TraceMetricKnownFieldKey.TIMESTAMP]: timestamp,
    [TraceMetricKnownFieldKey.TRACE_ID]: traceId,
    [TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise,
    [TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: observedTimestampPrecise,
    ...rest,
  };
}

export function MetricFixtureMeta(
  fixture: MetricsResponseItem | MetricsResponseItem[]
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
  };
}

interface MetricsTestInitOptions {
  organization?: Partial<Organization>;
  project?: Partial<Project>;
  routerQuery?: Record<string, any>;
  tracemetrics?: boolean;
}

type LocationConfig = {
  pathname: string;
  query?: Record<string, string | number | string[]>;
};

/**
 * Standardized initialization for metrics tests
 */
export function initializeMetricsTest({
  organization: orgOverrides = {},
  project: projectOverrides,
  tracemetrics = true,
  routerQuery = {},
}: MetricsTestInitOptions = {}): {
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
  setupEventsMock: (metricFixtures: MetricsResponseItem[]) => jest.Mock;
  setupPageFilters: () => void;
} {
  const baseFeatures = tracemetrics ? ['tracemetrics-enabled'] : [];

  const {organization, project} = initializeOrg({
    organization: {
      features: baseFeatures,
      ...orgOverrides,
    },
    projects: [projectOverrides ?? {}],
  });

  const initialLocation: LocationConfig = {
    pathname: `/organizations/${organization.slug}/explore/metrics/`,
    query: {
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
    PageFiltersStore.onInitializeUrlState(initialPageFilters, new Set());
  };

  const setupEventsMock = (metricFixtures: MetricsResponseItem[]) => {
    const eventsData: EventsMetricsResult = {
      data: metricFixtures,
      meta: MetricFixtureMeta(metricFixtures),
    };

    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: eventsData,
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
  };
}
