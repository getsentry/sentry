import React from 'react';
import {ThemeProvider} from '@emotion/react';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
  LogsPageParamsProvider,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_AGGREGATE_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import * as useLogsQueryModule from 'sentry/views/explore/logs/useLogsQuery';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {LogsAggregateTable} from './logsAggregateTable';

jest.mock('sentry/views/explore/logs/useLogsQuery');

jest.mock('sentry/utils/useLocation');
const mockUseLocation = jest.mocked(useLocation);

const queryClient = makeTestQueryClient();

describe('LogsAggregateTable', () => {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['ourlogs-enabled'],
    },
  });
  function createWrapper() {
    return function Wrapper({children}: {children?: React.ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <OrganizationContext.Provider value={organization}>
            <ThemeProvider theme={{}}>
              <LogsPageParamsProvider
                analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
              >
                {children}
              </LogsPageParamsProvider>
            </ThemeProvider>
          </OrganizationContext.Provider>
        </QueryClientProvider>
      );
    };
  }

  ProjectsStore.loadInitialData([project]);

  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState(
    {
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    },
    new Set()
  );

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: `/organizations/${organization.slug}/explore/logs/?end=2025-04-10T20%3A04%3A51&project=${project.id}&start=2025-04-10T14%3A37%3A55`,
        query: {
          [LOGS_AGGREGATE_SORT_BYS_KEY]: '-p99(severity_number)',
          [LOGS_QUERY_KEY]: 'test',
          [LOGS_GROUP_BY_KEY]: 'message.template',
          [LOGS_AGGREGATE_FN_KEY]: 'p99',
          [LOGS_AGGREGATE_PARAM_KEY]: 'severity_number',
          [LOGS_FIELDS_KEY]: ['timestamp', 'message'],
        },
      })
    );
  });

  it('renders loading state', () => {
    (useLogsQueryModule.useLogsAggregatesQuery as jest.Mock).mockReturnValue({
      isLoading: true,
      error: null,
      data: null,
      pageLinks: undefined,
    });
    render(<LogsAggregateTable />, {wrapper: createWrapper()});
    expect(screen.getByLabelText('Aggregates')).toBeInTheDocument();
  });

  it('renders error state', () => {
    (useLogsQueryModule.useLogsAggregatesQuery as jest.Mock).mockReturnValue({
      isLoading: false,
      error: 'Error!',
      data: null,
      pageLinks: undefined,
    });
    render(<LogsAggregateTable />, {wrapper: createWrapper()});
    expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    (useLogsQueryModule.useLogsAggregatesQuery as jest.Mock).mockReturnValue({
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
    });
    render(<LogsAggregateTable />, {wrapper: createWrapper()});
    const rows = screen.getAllByTestId('grid-body-row');
    expect(rows).toHaveLength(3);
    const expected = [
      ['Fetching the latest item id failed.', '17'],
      ['/usr/src/sentry/src/sentry/db/models/manager/base.py:282: derp', '13'],
      ['/usr/src/sentry/src/sentry/db/models/manager/base.py:282: herp', '12'],
    ];
    rows.forEach((row, i) => {
      const cells = within(row).getAllByTestId('grid-body-cell');
      expect(cells[0]).toHaveTextContent(expected[i]![0]!);
      expect(cells[1]).toHaveTextContent(expected[i]![1]!);
    });
  });
});
