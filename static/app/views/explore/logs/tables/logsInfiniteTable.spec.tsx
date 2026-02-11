import React from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {DEFAULT_TRACE_ITEM_HOVER_TIMEOUT} from 'sentry/views/explore/logs/constants';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
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

describe('LogsInfiniteTable', () => {
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled', 'ourlogs-replay-ui'],
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
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 123,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
    }),
    LogFixture({
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ID]: '2',
      [OurLogKnownFieldKey.MESSAGE]: 'test log body 2',
      [OurLogKnownFieldKey.RELEASE]: '1.0.0',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 123,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
    }),
    LogFixture({
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ID]: '3',
      [OurLogKnownFieldKey.MESSAGE]: 'test log body 3',
      [OurLogKnownFieldKey.RELEASE]: '1.0.0',
      [OurLogKnownFieldKey.CODE_FILE_PATH]:
        '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: 123,
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '1.0.0',
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

  beforeEach(() => {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();

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

  const renderWithProviders = (children: React.ReactNode) => {
    return render(
      <OrganizationContext.Provider value={organization}>
        <LogsQueryParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          source="location"
        >
          <LogsPageDataProvider>{children}</LogsPageDataProvider>
        </LogsQueryParamsProvider>
      </OrganizationContext.Provider>
    );
  };

  it('should render the table component', async () => {
    renderWithProviders(<LogsInfiniteTable />);

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });
  });

  it('should render with loading state initially', async () => {
    renderWithProviders(<LogsInfiniteTable />);

    const loadingIndicator = await screen.findByTestId('loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  it('should be interactable', async () => {
    jest.useFakeTimers();
    const traceItemMocks = [];
    for (const log of mockLogsData) {
      traceItemMocks.push(
        MockApiClient.addMockResponse({
          url: `/projects/${organization.slug}/${project.slug}/trace-items/${log[OurLogKnownFieldKey.ID]}/`,
          method: 'GET',
          body: {
            itemId: log[OurLogKnownFieldKey.ID],
            links: null,
            meta: {},
            timestamp: log[OurLogKnownFieldKey.TIMESTAMP],
            attributes: [],
          },
        })
      );
    }
    renderWithProviders(<LogsInfiniteTable />);

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });

    const allTreeRows = await screen.findAllByTestId('log-table-row');
    expect(allTreeRows).toHaveLength(3);
    for (const row of allTreeRows) {
      for (const field of visibleColumnFields) {
        await userEvent.hover(row, {delay: null});
        act(() => {
          jest.advanceTimersByTime(DEFAULT_TRACE_ITEM_HOVER_TIMEOUT + 1);
        });
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
    for (const mock of traceItemMocks) {
      expect(mock).toHaveBeenCalled();
    }
    jest.useRealTimers();
  });

  it('should not be interactable on embedded views', async () => {
    renderWithProviders(<LogsInfiniteTable embedded />);

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

    renderWithProviders(<LogsInfiniteTable />);

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

    renderWithProviders(<LogsInfiniteTable />);

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalled();
    });
  });

  it('quantizes log timestamps for replay links', async () => {
    const replayId = 'abc123def456';
    const replayId2 = 'abc123eef457';

    const firstLogTime = new Date('2025-04-10T08:37:30.000Z').getTime() * 1_000_000;
    const lastLogTime = new Date('2025-04-10T08:38:46.000Z').getTime() * 1_000_000;

    MockApiClient.clearMockResponses();

    const eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            [OurLogKnownFieldKey.ID]: '019621262d117e03bce898cb8f4f6ff7',
            [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
            [OurLogKnownFieldKey.TRACE_ID]: '17cc0bae407042eaa4bf6d798c37d026',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
            [OurLogKnownFieldKey.SEVERITY]: 'info',
            [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-10T08:37:30+00:00',
            [OurLogKnownFieldKey.MESSAGE]: 'first log message',
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: firstLogTime,
            [OurLogKnownFieldKey.REPLAY_ID]: replayId,
          },
          {
            [OurLogKnownFieldKey.ID]: '0196212624a17144aa392d01420256a2',
            [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
            [OurLogKnownFieldKey.TRACE_ID]: 'c331c2df93d846f5a2134203416d40bb',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
            [OurLogKnownFieldKey.SEVERITY]: 'info',
            [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-10T08:38:46+00:00',
            [OurLogKnownFieldKey.MESSAGE]: 'last log message',
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: lastLogTime,
            [OurLogKnownFieldKey.REPLAY_ID]: replayId2,
          },
        ],
        meta: {
          fields: {
            [OurLogKnownFieldKey.ID]: 'string',
            [OurLogKnownFieldKey.PROJECT_ID]: 'string',
            [OurLogKnownFieldKey.TRACE_ID]: 'string',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 'integer',
            [OurLogKnownFieldKey.SEVERITY]: 'string',
            [OurLogKnownFieldKey.TIMESTAMP]: 'string',
            [OurLogKnownFieldKey.MESSAGE]: 'string',
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 'number',
            [OurLogKnownFieldKey.REPLAY_ID]: 'string',
          },
          units: {},
          isMetricsData: false,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'ourlogs',
          dataScanned: 'full',
          accuracy: {
            confidence: [{}, {}],
          },
        },
        confidence: [{}, {}],
      },
    });

    const replayMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        [replayId]: 1,
        [replayId2]: 1,
      },
    });

    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: `/organizations/${organization.slug}/explore/logs/?end=2025-04-10T20%3A04%3A51&project=${project.id}&start=2025-04-10T14%3A37%3A55`,
        query: {
          [LOGS_FIELDS_KEY]: ['message', OurLogKnownFieldKey.REPLAY_ID],
          [LOGS_SORT_BYS_KEY]: '-timestamp',
          [LOGS_QUERY_KEY]: 'severity:error',
        },
      })
    );

    renderWithProviders(<LogsInfiniteTable />);

    expect(eventsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({
          field: expect.arrayContaining([
            'id',
            'project.id',
            'trace',
            'severity_number',
            'severity',
            'timestamp',
            'timestamp_precise',
            'observed_timestamp',
            'message',
            'replay_id',
          ]),
        }),
      })
    );

    await screen.findByText('first log message');
    await screen.findByText('last log message');

    const table = screen.getByTestId('logs-table');
    expect(table).toBeInTheDocument();
    expect(table).toHaveTextContent('first log message');
    expect(table).toHaveTextContent('last log message');

    await waitFor(() => {
      expect(replayMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/replay-count/`,
        expect.objectContaining({
          query: expect.objectContaining({
            data_source: 'discover',
            project: -1,
            query: 'replay_id:[abc123def456,abc123eef457]',
            start: '2025-04-10T08:00:00.000Z',
            end: '2025-04-10T10:00:00.000Z',
            statsPeriod: undefined,
          }),
        })
      );
    });

    await screen.findByText('abc123de');
    await screen.findByText('abc123ee');
  });
});
