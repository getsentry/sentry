import React from 'react';
import qs from 'query-string';
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
  type RenderOptions,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
  LOGS_ROW_ID_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {DEFAULT_TRACE_ITEM_HOVER_TIMEOUT} from 'sentry/views/explore/logs/constants';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

jest.mock('@tanstack/react-virtual', () => {
  return {
    useWindowVirtualizer: jest.fn().mockReturnValue({
      getVirtualItems: jest.fn().mockReturnValue([
        {key: '1', index: 0, start: 0, end: 50, lane: 0},
        {key: '2', index: 1, start: 50, end: 100, lane: 0},
        {key: '3', index: 2, start: 100, end: 150, lane: 0},
      ]),
      getTotalSize: jest.fn().mockReturnValue(150),
      measure: jest.fn(),
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
      measure: jest.fn(),
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
    features: ['ourlogs-enabled'],
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

  const defaultRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        [LOGS_FIELDS_KEY]: visibleColumnFields,
        [LOGS_SORT_BYS_KEY]: '-timestamp',
        [LOGS_QUERY_KEY]: 'severity:error',
      },
    },
  };

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

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/1.0.0/`,
      body: {
        id: 10,
        lastCommit: {
          id: '1e5a9462e6ac23908299b218e18377837297bda1',
        },
      },
    });

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

    for (const log of mockLogsData) {
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
      });
    }
  });

  function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <OrganizationContext.Provider value={organization}>
        <LogsQueryParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          source="location"
        >
          <LogsPageDataProvider>{children}</LogsPageDataProvider>
        </LogsQueryParamsProvider>
      </OrganizationContext.Provider>
    );
  }

  const renderWithProviders = (children: React.ReactElement, options?: RenderOptions) => {
    return render(children, {
      additionalWrapper: Wrapper,
      initialRouterConfig: defaultRouterConfig,
      ...options,
    });
  };

  it('should render the table component', async () => {
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });
  });

  it('should render with loading state initially', async () => {
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />
    );

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
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />
    );

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
        expect(actionsButton).toBeInTheDocument();
      }
    }
    for (const mock of traceItemMocks) {
      expect(mock).toHaveBeenCalled();
    }
    jest.useRealTimers();
  });

  it('should not be interactable on embedded views', async () => {
    renderWithProviders(
      <LogsInfiniteTable
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        embedded
      />
    );

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

    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />
    );

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

    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />
    );

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

    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: ['message', OurLogKnownFieldKey.REPLAY_ID],
              [LOGS_SORT_BYS_KEY]: '-timestamp',
              [LOGS_QUERY_KEY]: 'severity:error',
            },
          },
        },
      }
    );

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
            data_source: 'events',
            project: -1,
            query: 'replay_id:[abc123def456,abc123eef457]',
            start: '2025-04-10T08:00:00.000Z',
            end: '2025-04-10T10:00:00.000Z',
          }),
        })
      );
    });

    await screen.findByText('abc123de');
    await screen.findByText('abc123ee');
  });

  it('renders a pin button on a hovered row when ourlogs-pinning is enabled', async () => {
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: visibleColumnFields,
              [LOGS_SORT_BYS_KEY]: '-timestamp',
              [LOGS_QUERY_KEY]: 'severity:error',
              logsPinning: 'true',
            },
          },
        },
      }
    );

    const [firstRow] = await screen.findAllByTestId('log-table-row');
    await userEvent.hover(firstRow!);

    expect(
      await within(firstRow!).findByRole('button', {name: 'Pin log row'})
    ).toBeInTheDocument();
  });

  it('does not render a pin button when ourlogs-pinning is disabled', async () => {
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />
    );

    const [firstRow] = await screen.findAllByTestId('log-table-row');
    await userEvent.hover(firstRow!);

    expect(
      within(firstRow!).queryByRole('button', {name: 'Pin log row'})
    ).not.toBeInTheDocument();
  });

  it('marks the row as pinned when its id is in the logsPinned query', async () => {
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: visibleColumnFields,
              [LOGS_SORT_BYS_KEY]: '-timestamp',
              [LOGS_QUERY_KEY]: 'severity:error',
              logsPinning: 'true',
              logsPinned: '1',
            },
          },
        },
      }
    );

    const [firstRow] = await screen.findAllByTestId('log-table-row');

    expect(screen.getByTestId('pinned-logs-table-body').contains(firstRow ?? null)).toBe(
      true
    );
  });

  it('highlights and expands the row referenced by the logsRowId param', async () => {
    const traceItemRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/1/`,
      method: 'GET',
      body: {
        itemId: '1',
        links: null,
        meta: {},
        timestamp: mockLogsData[0]![OurLogKnownFieldKey.TIMESTAMP],
        attributes: [],
      },
    });

    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: visibleColumnFields,
              [LOGS_SORT_BYS_KEY]: '-timestamp',
              [LOGS_ROW_ID_KEY]: '1',
            },
          },
        },
      }
    );

    const rows = await screen.findAllByTestId('log-table-row');
    const linkedRow = rows.find(row => within(row).queryByText('test log body 1'))!;
    const otherRow = rows.find(row => within(row).queryByText('test log body 2'))!;

    expect(linkedRow).toHaveAttribute('data-row-linked', 'true');
    expect(otherRow).not.toHaveAttribute('data-row-linked', 'true');
    // The linked row is expanded on load: its detail actions render and its
    // full details are fetched.
    expect(await screen.findByRole('button', {name: 'Copy as JSON'})).toBeInTheDocument();
    await waitFor(() => expect(traceItemRequest).toHaveBeenCalled());
  });

  it('expands the linked row when navigation adds logsRowId', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/2/`,
      method: 'GET',
      body: {
        itemId: '2',
        links: null,
        meta: {},
        timestamp: mockLogsData[1]![OurLogKnownFieldKey.TIMESTAMP],
        attributes: [],
      },
    });

    const {router} = renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: visibleColumnFields,
              [LOGS_SORT_BYS_KEY]: '-timestamp',
            },
          },
        },
      }
    );

    await screen.findAllByTestId('log-table-row');
    // Nothing is expanded before a logsRowId is present.
    expect(screen.queryByRole('button', {name: 'Copy as JSON'})).not.toBeInTheDocument();

    router.navigate(
      `/organizations/${organization.slug}/explore/logs/?${qs.stringify({
        [LOGS_FIELDS_KEY]: visibleColumnFields,
        [LOGS_SORT_BYS_KEY]: '-timestamp',
        [LOGS_ROW_ID_KEY]: '2',
      })}`
    );

    // The newly linked row expands in place: its detail actions now render.
    expect(await screen.findByRole('button', {name: 'Copy as JSON'})).toBeInTheDocument();
    const rows = screen.getAllByTestId('log-table-row');
    const newlyLinkedRow = rows.find(row => within(row).queryByText('test log body 2'))!;
    expect(newlyLinkedRow).toHaveAttribute('data-row-linked', 'true');
  });

  it('links the body instance hover state when the pinned instance is hovered', async () => {
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: visibleColumnFields,
              [LOGS_SORT_BYS_KEY]: '-timestamp',
              [LOGS_QUERY_KEY]: 'severity:error',
              logsPinning: 'true',
              logsPinned: '1',
            },
          },
        },
      }
    );

    const pinnedTableBody = await screen.findByTestId('pinned-logs-table-body');
    const rows = await screen.findAllByTestId('log-table-row');
    const pinnedRow = rows.find(row => pinnedTableBody.contains(row))!;
    const tbodyRow = rows.find(
      row => !pinnedTableBody.contains(row) && within(row).queryByText('test log body 1')
    )!;

    await userEvent.hover(pinnedRow);

    await waitFor(() => {
      expect(tbodyRow).toHaveAttribute('data-row-hover-linked', 'true');
    });
    expect(pinnedRow).toHaveAttribute('data-row-hover-linked', 'true');
  });

  it('links the pinned instance hover state when the body instance is hovered', async () => {
    renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: visibleColumnFields,
              [LOGS_SORT_BYS_KEY]: '-timestamp',
              [LOGS_QUERY_KEY]: 'severity:error',
              logsPinning: 'true',
              logsPinned: '1',
            },
          },
        },
      }
    );

    const pinnedTableBody = await screen.findByTestId('pinned-logs-table-body');
    const rows = await screen.findAllByTestId('log-table-row');
    const pinnedRow = rows.find(row => pinnedTableBody.contains(row))!;
    const tbodyRow = rows.find(
      row => !pinnedTableBody.contains(row) && within(row).queryByText('test log body 1')
    )!;

    await userEvent.hover(tbodyRow);

    await waitFor(() => {
      expect(pinnedRow).toHaveAttribute('data-row-hover-linked', 'true');
    });
    expect(tbodyRow).toHaveAttribute('data-row-hover-linked', 'true');
  });

  it('cycles column sort: unsorted → desc → asc → reset to default timestamp desc', async () => {
    // Start with severity sorted ascending (second click has already happened)
    const {router} = renderWithProviders(
      <LogsInfiniteTable analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_FIELDS_KEY]: visibleColumnFields,
              [LOGS_SORT_BYS_KEY]: 'severity',
            },
          },
        },
        organization,
      }
    );

    // Wait for table headers to be rendered (empty while pending)
    const severityHeader = await screen.findByText('Severity');

    // Third click (asc → reset): should navigate to default timestamp desc sort
    await userEvent.click(severityHeader);
    expect(router.location.query[LOGS_SORT_BYS_KEY]).toBe('-timestamp');
  });
});
