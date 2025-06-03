import React from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
  LogsPageParamsProvider,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockUseLocation = jest.mocked(useLocation);

jest.mock('sentry/utils/useRelease', () => ({
  useRelease: jest.fn().mockReturnValue({
    data: {
      id: 10,
      lastCommit: {
        id: '1e5a9462e6ac23908299b218e18377837297bda1',
      },
    },
  }),
}));

jest.mock('sentry/components/events/interfaces/frame/useStacktraceLink', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    data: {
      sourceUrl: 'https://some-stacktrace-link',
      integrations: [],
    },
    error: null,
    isPending: false,
  }),
}));

jest.mock('@tanstack/react-virtual', () => {
  return {
    useWindowVirtualizer: jest.fn().mockReturnValue({
      getVirtualItems: jest.fn().mockReturnValue([
        {key: '1', index: 0, start: 0, end: 50, lane: 0},
        {key: '2', index: 1, start: 50, end: 100, lane: 0},
        {key: '3', index: 2, start: 100, end: 150, lane: 0},
      ]),
      getTotalSize: jest.fn().mockReturnValue(150),
      options: {
        scrollMargin: 0,
      },
      scrollDirection: 'forward',
      scrollOffset: 0,
      isScrolling: false,
    }),
    useVirtualizer: jest.fn().mockReturnValue({
      getVirtualItems: jest.fn().mockReturnValue([
        {key: '1', index: 0, start: 0, end: 50, lane: 0},
        {key: '2', index: 1, start: 50, end: 100, lane: 0},
        {key: '3', index: 2, start: 100, end: 150, lane: 0},
      ]),
      getTotalSize: jest.fn().mockReturnValue(150),
      options: {
        scrollMargin: 0,
      },
      scrollDirection: 'forward',
      scrollOffset: 0,
      isScrolling: false,
    }),
  };
});

describe('LogsInfiniteTable', function () {
  const organization = OrganizationFixture({
    features: ['ourlogs', 'ourlogs-enabled', 'ourlogs-infinite-scroll'],
  });
  const project = ProjectFixture();

  const mockLogsData = [
    LogFixture({
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ID]: '1',
      [OurLogKnownFieldKey.MESSAGE]: 'test log body 1',
      [OurLogKnownFieldKey.RELEASE]: '1.0.0',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
    }),
    LogFixture({
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ID]: '2',
      [OurLogKnownFieldKey.MESSAGE]: 'test log body 2',
      [OurLogKnownFieldKey.RELEASE]: '1.0.0',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
    }),
    LogFixture({
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ID]: '3',
      [OurLogKnownFieldKey.MESSAGE]: 'test log body 3',
      [OurLogKnownFieldKey.RELEASE]: '1.0.0',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
    }),
  ];

  const visibleColumnFields = [
    OurLogKnownFieldKey.RELEASE,
    OurLogKnownFieldKey.CODE_FILE_PATH,
    OurLogKnownFieldKey.MESSAGE,
    OurLogKnownFieldKey.TRACE_ID,
    OurLogKnownFieldKey.SEVERITY_NUMBER,
    OurLogKnownFieldKey.SEVERITY,
    OurLogKnownFieldKey.TIMESTAMP,
  ];

  const frozenColumnFields = [OurLogKnownFieldKey.TIMESTAMP, OurLogKnownFieldKey.MESSAGE];

  beforeEach(function () {
    jest.restoreAllMocks();

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

    MockApiClient.clearMockResponses();
    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: `/organizations/${organization.slug}/explore/logs/?end=2025-04-10T20%3A04%3A51&project=${project.id}&start=2025-04-10T14%3A37%3A55`,
        query: {
          [LOGS_FIELDS_KEY]: visibleColumnFields,
          [LOGS_SORT_BYS_KEY]: '-timestamp',
          [LOGS_QUERY_KEY]: 'severity:error',
        },
      })
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: mockLogsData,
        meta: {
          fields: {
            [OurLogKnownFieldKey.ID]: 'string',
            [OurLogKnownFieldKey.PROJECT_ID]: 'string',
            [OurLogKnownFieldKey.ORGANIZATION_ID]: 'integer',
            [OurLogKnownFieldKey.MESSAGE]: 'string',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 'integer',
            [OurLogKnownFieldKey.SEVERITY]: 'string',
            [OurLogKnownFieldKey.TIMESTAMP]: 'string',
            [OurLogKnownFieldKey.TRACE_ID]: 'string',
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 'number',
            [OurLogKnownFieldKey.CODE_FILE_PATH]: 'string',
            [OurLogKnownFieldKey.RELEASE]: 'string',
          },
          units: {},
        },
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      method: 'GET',
      body: {},
    });
  });

  const renderWithProviders = (children: React.ReactNode, isTableFrozen = false) => {
    return render(
      <OrganizationContext.Provider value={organization}>
        <LogsPageParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          isTableFrozen={isTableFrozen}
        >
          <LogsPageDataProvider>{children}</LogsPageDataProvider>
        </LogsPageParamsProvider>
      </OrganizationContext.Provider>
    );
  };

  it('should render the table component', async () => {
    renderWithProviders(<LogsInfiniteTable showHeader />);

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });
  });

  it('should render with loading state initially', async () => {
    renderWithProviders(<LogsInfiniteTable showHeader />);

    const loadingIndicator = await screen.findByTestId('loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  it('should be interactable', async () => {
    renderWithProviders(<LogsInfiniteTable showHeader />);

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });

    const allTreeRows = await screen.findAllByTestId('log-table-row');
    expect(allTreeRows).toHaveLength(3);
    for (const row of allTreeRows) {
      for (const field of visibleColumnFields) {
        await userEvent.hover(row);
        const cell = await within(row).findByTestId(`log-table-cell-${field}`);
        const actionsButton = within(cell).queryByRole('button', {
          name: 'Actions',
        });
        if (field === 'timestamp') {
          expect(actionsButton).toBeNull();
        } else {
          expect(actionsButton).toBeInTheDocument();
        }
      }
    }
  });

  it('should not be interactable on embedded views', async () => {
    renderWithProviders(<LogsInfiniteTable showHeader />, true);

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });

    const allTreeRows = await screen.findAllByTestId('log-table-row');
    expect(allTreeRows).toHaveLength(3);
    for (const row of allTreeRows) {
      for (const field of frozenColumnFields) {
        const cell = await within(row).findByTestId(`log-table-cell-${field}`);
        const actionsButton = within(cell).queryByRole('button', {
          name: 'Actions',
        });
        expect(actionsButton).not.toBeInTheDocument();
      }
    }
  });

  it('shows empty state when no data', async () => {
    MockApiClient.clearMockResponses();
    const emptyApiMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {
          fields: {},
          units: {},
        },
      },
    });

    renderWithProviders(<LogsInfiniteTable showHeader />);

    await waitFor(() => {
      expect(emptyApiMock).toHaveBeenCalled();
    });
  });

  it('handles errors when API call fails', async () => {
    MockApiClient.clearMockResponses();
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
    });

    renderWithProviders(<LogsInfiniteTable showHeader />);

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalled();
    });
  });
});
