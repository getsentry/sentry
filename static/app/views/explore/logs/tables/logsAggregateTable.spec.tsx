import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import RequestError from 'sentry/utils/requestError/requestError';
import {
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_AGGREGATE_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {type useLogsAggregatesTable} from 'sentry/views/explore/logs/useLogsAggregatesTable';

import {LogsAggregateTable} from './logsAggregateTable';

describe('LogsAggregateTable', () => {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['ourlogs-enabled'],
    },
  });
  function LogsAggregateTableWithParamsProvider({
    aggregatesTableResult,
  }: {
    aggregatesTableResult: ReturnType<typeof useLogsAggregatesTable>;
  }) {
    return (
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsAggregateTable aggregatesTableResult={aggregatesTableResult} />
      </LogsQueryParamsProvider>
    );
  }

  ProjectsStore.loadInitialData([project]);

  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState({
    projects: [parseInt(project.id, 10)],
    environments: [],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: null,
    },
  });
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        project: project.id,
        start: '2025-04-10T14%3A37%3A55',
        end: '2025-04-10T20%3A04%3A51',
        [LOGS_AGGREGATE_SORT_BYS_KEY]: '-p99(severity_number)',
        [LOGS_QUERY_KEY]: 'test',
        [LOGS_GROUP_BY_KEY]: 'message.template',
        [LOGS_AGGREGATE_FN_KEY]: 'p99',
        [LOGS_AGGREGATE_PARAM_KEY]: 'severity_number',
        [LOGS_FIELDS_KEY]: ['timestamp', 'message'],
      },
    },
    route: '/organizations/:orgId/explore/logs/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders loading state', () => {
    render(
      <LogsAggregateTableWithParamsProvider
        aggregatesTableResult={
          {
            isLoading: true,
            error: null,
            data: undefined,
            pageLinks: undefined,
          } as any
        }
      />,
      {initialRouterConfig}
    );
    expect(screen.getByLabelText('Aggregates')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(
      <LogsAggregateTableWithParamsProvider
        aggregatesTableResult={
          {
            isLoading: false,
            error: new RequestError('GET', '/', new Error('Error!')),
            data: undefined,
            pageLinks: undefined,
          } as any
        }
      />,
      {initialRouterConfig}
    );
    expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(
      <LogsAggregateTableWithParamsProvider
        aggregatesTableResult={
          {
            isLoading: false,
            error: null,
            data: {
              data: [
                {
                  'message.template': 'Fetching the latest item id failed.',
                  'p99(severity_number)': 17.0,
                },
                {
                  'message.template':
                    '/usr/src/sentry/src/sentry/db/models/manager/base.py:282: derp',
                  'p99(severity_number)': 13.0,
                },
                {
                  'message.template':
                    '/usr/src/sentry/src/sentry/db/models/manager/base.py:282: herp',
                  'p99(severity_number)': 12.0,
                },
              ],
            },
            pageLinks: undefined,
          } as any
        }
      />,
      {initialRouterConfig}
    );
    const rows = screen.getAllByTestId('grid-body-row');
    expect(rows).toHaveLength(3);
    const expected = [
      ['Fetching the latest item id failed.', '17'],
      ['/usr/src/sentry/src/sentry/db/models/manager/base.py:282: derp', '13'],
      ['/usr/src/sentry/src/sentry/db/models/manager/base.py:282: herp', '12'],
    ];
    rows.forEach((row, i) => {
      const cells = within(row).getAllByTestId('grid-body-cell');
      expect(cells[1]).toHaveTextContent(expected[i]![0]!);
      expect(cells[2]).toHaveTextContent(expected[i]![1]!);
    });
  });
});
