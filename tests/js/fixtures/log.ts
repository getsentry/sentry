import pick from 'lodash/pick';

import {initializeOrg} from 'sentry-test/initializeOrg';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {FieldKind} from 'sentry/utils/fields';
import {LOGS_REFRESH_INTERVAL_KEY} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import type {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {
  EventsLogsResult,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {AttributeResults} from 'sentry/views/settings/components/dataScrubbing/types';
import {AllowedDataScrubbingDatasets} from 'sentry/views/settings/components/dataScrubbing/types';

export function LogFixture({
  [OurLogKnownFieldKey.PROJECT_ID]: projectId,
  [OurLogKnownFieldKey.ORGANIZATION_ID]: organizationId,
  [OurLogKnownFieldKey.ID]: id,
  [OurLogKnownFieldKey.MESSAGE]: message = 'test log body',
  [OurLogKnownFieldKey.SEVERITY_NUMBER]: severityNumber = 456,
  [OurLogKnownFieldKey.SEVERITY]: severity = 'error',
  [OurLogKnownFieldKey.TIMESTAMP]: timestamp = '2025-04-03T15:50:10+00:00',
  [OurLogKnownFieldKey.TRACE_ID]: traceId = '7b91699fd385d9fd52e0c4bc',
  [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise = 1.744312870049196e18,
  [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]:
    observedTimestampPrecise = 1.744312870049196e18,
  ...rest
}: Partial<OurLogsResponseItem> &
  Required<
    Pick<
      OurLogsResponseItem,
      | OurLogKnownFieldKey.ID
      | OurLogKnownFieldKey.PROJECT_ID
      | OurLogKnownFieldKey.ORGANIZATION_ID
    >
  >): OurLogsResponseItem {
  return {
    [OurLogKnownFieldKey.ID]: String(id),
    [OurLogKnownFieldKey.PROJECT_ID]: String(projectId),
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organizationId),
    [OurLogKnownFieldKey.MESSAGE]: message,
    [OurLogKnownFieldKey.SEVERITY_NUMBER]: severityNumber,
    [OurLogKnownFieldKey.SEVERITY]: severity,
    [OurLogKnownFieldKey.TIMESTAMP]: timestamp,
    [OurLogKnownFieldKey.TRACE_ID]: traceId,
    [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise,
    [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: observedTimestampPrecise,
    ...rest,
  };
}

// Incomplete, only provides type of field if it's a string or number.
export function LogFixtureMeta(
  fixture: OurLogsResponseItem | OurLogsResponseItem[]
): EventsMetaType {
  const logFixtures = Array.isArray(fixture) ? fixture : [fixture];
  const fields = logFixtures.flatMap(logFixture =>
    Object.entries(logFixture).map(([key, value]) => {
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

interface LogsTestInitOptions {
  isProjectOnboarded?: boolean;
  liveRefresh?: boolean;
  organization?: Partial<Organization>;
  ourlogs?: boolean;
  pageFiltersPeriod?: string;
  project?: Partial<Project>;
  refreshInterval?: string;
  routerQuery?: Record<string, any>;
}

// Narrowed type from sentry-test/reactTestingLibrary.tsx
type LocationConfig = {
  pathname: string;
  query?: Record<string, string | number | string[]>;
};

/**
 * Standardized initialization for logs tests
 */
export function initializeLogsTest({
  organization: orgOverrides = {},
  project: projectOverrides,
  ourlogs = true,
  routerQuery = {},
  refreshInterval = '60', // Fast refresh for testing, should always exceed waitFor internal timer interval (50ms default)
}: LogsTestInitOptions = {}): {
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
  setupEventsMock: (logFixtures: OurLogsResponseItem[]) => jest.Mock;
  setupPageFilters: () => void;
  setupTraceItemsMock: (logFixtures: OurLogsResponseItem[]) => jest.Mock[];
} {
  const baseFeatures = ourlogs ? ['ourlogs-enabled'] : [];

  const forcedProject = projectOverrides ?? {hasLogs: true};
  const {organization, project} = initializeOrg({
    organization: {
      features: baseFeatures,
      ...orgOverrides,
    },
    projects: [forcedProject],
  });

  const initialLocation: LocationConfig = {
    pathname: `/organizations/${organization.slug}/explore/logs/`,
    query: {
      [LOGS_SORT_BYS_KEY]: '-timestamp',
      [LOGS_REFRESH_INTERVAL_KEY]: refreshInterval, // Fast refresh for testing, should always exceed waitFor internal timer interval (50ms default)
      ...routerQuery,
    },
  };

  const routerConfig: {
    location: LocationConfig;
    route?: string;
  } = {
    location: initialLocation,
    route: '/organizations/:orgId/explore/logs/',
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

  const setupEventsMock = (logFixtures: OurLogsResponseItem[]) => {
    const eventsData: EventsLogsResult = {
      data: logFixtures,
      meta: LogFixtureMeta(logFixtures),
    };

    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: eventsData,
    });
  };

  const setupTraceItemsMock = (logFixtures: OurLogsResponseItem[]) => {
    return logFixtures.map(logFixture => {
      const attributes: TraceItemResponseAttribute[] = Object.entries(logFixture).map(
        ([k, v]) => {
          if (typeof v === 'string') {
            return {name: k, value: v, type: 'str' as const};
          }
          return {name: k, value: Number(v), type: 'float' as const};
        }
      );

      return MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/trace-items/${logFixture[OurLogKnownFieldKey.ID]}/`,
        method: 'GET',
        body: {
          itemId: logFixture[OurLogKnownFieldKey.ID],
          links: null,
          meta: LogFixtureMeta(logFixture),
          timestamp: logFixture[OurLogKnownFieldKey.TIMESTAMP],
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
 * Standard set of log fixtures for testing - can be sliced as needed
 * Creates logs in descending timestamp order (newest first)
 * Returns both base fixtures (minimal fields) and detailed fixtures (all fields)
 */
export function createLogFixtures(
  organization: Organization,
  project: Project,
  nowDate: Date,
  options: {
    baseFields?: string[];
    intervalMs?: number;
  } = {}
): {
  baseFixtures: OurLogsResponseItem[];
  detailedFixtures: OurLogsResponseItem[];
} {
  const {intervalMs = 1000} = options;
  const nowTimestamp = nowDate.getTime();

  // Default base fields - minimal fields for basic testing
  const defaultBaseFields = [
    OurLogKnownFieldKey.ID,
    OurLogKnownFieldKey.PROJECT_ID,
    OurLogKnownFieldKey.ORGANIZATION_ID,
    OurLogKnownFieldKey.MESSAGE,
    OurLogKnownFieldKey.SEVERITY,
    OurLogKnownFieldKey.TIMESTAMP,
    OurLogKnownFieldKey.TRACE_ID,
  ];

  const baseFieldKeys = options.baseFields || defaultBaseFields;

  const logData: Array<Partial<Record<OurLogKnownFieldKey, string | number>>> = [
    {
      [OurLogKnownFieldKey.ID]: '1',
      [OurLogKnownFieldKey.PROJECT_ID]: project.id,
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: 'Error occurred in authentication service',
      [OurLogKnownFieldKey.SEVERITY]: 'error',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 17,
      [OurLogKnownFieldKey.TRACE_ID]: '7b91699fd385d9fd52e0c4bc',
      [OurLogKnownFieldKey.RELEASE]: '1.0.0',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 123,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [OurLogKnownFieldKey.ID]: '2',
      [OurLogKnownFieldKey.PROJECT_ID]: project.id,
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: 'User login successful',
      [OurLogKnownFieldKey.SEVERITY]: 'info',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
      [OurLogKnownFieldKey.TRACE_ID]: '8c92799fe496e0ee63f1d5cd',
      [OurLogKnownFieldKey.RELEASE]: '1.0.0',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 456,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [OurLogKnownFieldKey.ID]: '3',
      [OurLogKnownFieldKey.PROJECT_ID]: project.id,
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: 'Database connection warning',
      [OurLogKnownFieldKey.SEVERITY]: 'warn',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 13,
      [OurLogKnownFieldKey.TRACE_ID]: '9d03800gf5a7f1ff74g2e6de',
      [OurLogKnownFieldKey.RELEASE]: '1.0.1',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 789,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [OurLogKnownFieldKey.ID]: '4',
      [OurLogKnownFieldKey.PROJECT_ID]: project.id,
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: 'Request processed successfully',
      [OurLogKnownFieldKey.SEVERITY]: 'info',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
      [OurLogKnownFieldKey.TRACE_ID]: 'ae14911hg6b8g2gg85h3f7ef',
      [OurLogKnownFieldKey.RELEASE]: '1.0.1',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 321,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
    {
      [OurLogKnownFieldKey.ID]: '5',
      [OurLogKnownFieldKey.PROJECT_ID]: project.id,
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: 'Debug trace information',
      [OurLogKnownFieldKey.SEVERITY]: 'debug',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 5,
      [OurLogKnownFieldKey.TRACE_ID]: 'bf25022ih7c9h3hh96i4g8fg',
      [OurLogKnownFieldKey.RELEASE]: '1.0.1',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 654,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
    },
  ];

  const fixtures = logData.map((data, index) => {
    const logTimestamp = nowTimestamp - index * intervalMs;
    const completeLogData = {
      ...data,
      [OurLogKnownFieldKey.TIMESTAMP]: new Date(logTimestamp).toISOString(),
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(BigInt(logTimestamp) * 1_000_000n),
    };
    return completeLogData;
  });

  // Used for /events mock
  const baseFixtures = fixtures.map(completeLogData => {
    const baseOnlyFields = pick(completeLogData, baseFieldKeys);
    return LogFixture(baseOnlyFields as any);
  });

  // Used for /trace-items mock
  const detailedFixtures = fixtures.map(completeLogData => {
    return LogFixture(completeLogData as any);
  });

  return {
    baseFixtures,
    detailedFixtures,
  };
}

/**
 * Creates mock attribute results for data scrubbing tests
 */
export function createMockAttributeResults(empty = false): AttributeResults {
  const mockAttributes: TagCollection = {
    'user.email': {
      key: 'user.email',
      name: 'user.email',
      kind: FieldKind.TAG,
    },
    'user.id': {
      key: 'user.id',
      name: 'user.id',
      kind: FieldKind.TAG,
    },
    'custom.field': {
      key: 'custom.field',
      name: 'custom.field',
      kind: FieldKind.TAG,
    },
    'request.method': {
      key: 'request.method',
      name: 'request.method',
      kind: FieldKind.TAG,
    },
    'response.status': {
      key: 'response.status',
      name: 'response.status',
      kind: FieldKind.TAG,
    },
  };

  const mockTraceItemAttributeKeysResult: ReturnType<typeof useTraceItemAttributeKeys> = {
    attributes: mockAttributes,
    isLoading: false,
    error: null,
  };

  const mockTraceItemAttributeKeysEmptyResult: ReturnType<
    typeof useTraceItemAttributeKeys
  > = {
    attributes: {},
    isLoading: false,
    error: null,
  };

  if (empty) {
    return {
      [AllowedDataScrubbingDatasets.DEFAULT]: null,
      [AllowedDataScrubbingDatasets.LOGS]: mockTraceItemAttributeKeysEmptyResult,
    };
  }

  return {
    [AllowedDataScrubbingDatasets.DEFAULT]: null,
    [AllowedDataScrubbingDatasets.LOGS]: mockTraceItemAttributeKeysResult,
  };
}
