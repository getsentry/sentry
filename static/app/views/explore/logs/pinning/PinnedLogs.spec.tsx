import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  screen,
  userEvent,
  type RenderOptions,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {PinnedLogs} from 'sentry/views/explore/logs/pinning/PinnedLogs';
import {useLogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import {usePinnedLogsQuery} from 'sentry/views/explore/logs/pinning/usePinnedLogsQuery';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';

const organization = OrganizationFixture({
  features: ['ourlogs-enabled'],
});

const allRows: OurLogsResponseItem[] = [
  LogFixture({
    [OurLogKnownFieldKey.ID]: 'log-1',
    [OurLogKnownFieldKey.PROJECT_ID]: '1',
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
    [OurLogKnownFieldKey.MESSAGE]: 'first pinned log',
    [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 2_000_000_000_000_000_000,
  }),
  LogFixture({
    [OurLogKnownFieldKey.ID]: 'log-2',
    [OurLogKnownFieldKey.PROJECT_ID]: '1',
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
    [OurLogKnownFieldKey.MESSAGE]: 'second pinned log',
    [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1_000_000_000_000_000_000,
  }),
];

const renderRow = (dataRow: OurLogsResponseItem) => (
  <tr data-test-id={`pinned-row-${dataRow[OurLogKnownFieldKey.ID]}`}>
    <td>{dataRow[OurLogKnownFieldKey.MESSAGE]}</td>
  </tr>
);

function PinnedLogsWrapper() {
  const logsPinning = useLogsPinning()!;
  const pinnedLogsQuery = usePinnedLogsQuery({allRows, logsPinning});

  return (
    <table>
      <PinnedLogs
        allRows={allRows}
        logsPinning={logsPinning}
        pinnedLogsQuery={pinnedLogsQuery}
        renderRow={renderRow}
      />
    </table>
  );
}

function AdditionalWrapper({children}: {children: React.ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

function renderPinnedLogs(options: RenderOptions = {}) {
  return render(<PinnedLogsWrapper />, {
    organization,
    additionalWrapper: AdditionalWrapper,
    ...options,
  });
}

describe('PinnedLogs', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });
  });

  it('renders nothing when no rows are pinned', () => {
    renderPinnedLogs();

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('renders the pinned row when its id is present in allRows', () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    expect(screen.getByTestId('pinned-row-log-1')).toBeInTheDocument();
  });

  it('renders the pinned row when it is fetched from the API but not in allRows', async () => {
    const fetchedRow = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-3',
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
      [OurLogKnownFieldKey.MESSAGE]: 'fetched pinned log',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [fetchedRow], meta: {fields: {id: 'string'}, units: {}}},
    });

    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-3'}},
      },
    });

    expect(await screen.findByTestId('pinned-row-log-3')).toBeInTheDocument();
  });

  it('shows a loading placeholder while a missing pinned row is being fetched', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      asyncDelay: Infinity,
      body: {data: [], meta: {fields: {}, units: {}}},
    });

    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'missing-log'}},
      },
    });

    expect(await screen.findByTestId('loading-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('pinned-row-missing-log')).not.toBeInTheDocument();
  });

  it('renders an unavailable row and keeps the pin when a log is not found in either window', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}}},
    });

    const {router} = renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'missing-log'}},
      },
    });

    expect(
      await screen.findByText('Pinned log unavailable in the selected time range')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse 1 pinned'})).toBeInTheDocument();
    expect(router.location.query.logsPinned).toBe('missing-log');
  });

  it('keeps a resolved-unavailable pin shown while a newly pinned log is still loading', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({query: 'id:[log-a]'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      asyncDelay: Infinity,
      body: {data: [], meta: {fields: {}, units: {}}},
      match: [MockApiClient.matchQuery({query: 'id:[log-b]'})],
    });

    const {router} = renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-a'}},
      },
    });

    expect(
      await screen.findByText('Pinned log unavailable in the selected time range')
    ).toBeInTheDocument();

    act(() => {
      router.navigate('/?logsPinned=log-a,log-b');
    });

    expect(await screen.findByTestId('loading-placeholder')).toBeInTheDocument();
    expect(
      screen.getByText('Pinned log unavailable in the selected time range')
    ).toBeInTheDocument();
  });

  it('renders a count matching the rendered rows when some pins are unavailable', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}}},
    });

    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1,missing-log'}},
      },
    });

    expect(
      await screen.findByText('Pinned log unavailable in the selected time range')
    ).toBeInTheDocument();
    expect(screen.getByTestId('pinned-row-log-1')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse 2 pinned'})).toBeInTheDocument();
  });

  it('renders a retry control and recovers when the pinned logs query errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'missing-log'}},
      },
    });

    expect(await screen.findByText('Could not load pinned log')).toBeInTheDocument();

    const fetchedRow = LogFixture({
      [OurLogKnownFieldKey.ID]: 'missing-log',
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
      [OurLogKnownFieldKey.MESSAGE]: 'recovered pinned log',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [fetchedRow], meta: {fields: {id: 'string'}, units: {}}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(await screen.findByTestId('pinned-row-missing-log')).toBeInTheDocument();
  });

  it('renders pinned rows in ascending order when sorted ascending', () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {logsPinned: 'log-1,log-2', logsSortBys: 'timestamp'},
        },
      },
    });

    const renderedIds = screen
      .getAllByTestId(/^pinned-row-/)
      .map(row => row.getAttribute('data-test-id'));

    expect(renderedIds).toEqual(['pinned-row-log-2', 'pinned-row-log-1']);
  });

  it('shows the count of pinned rows in the collapse toggle label', () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1,log-2'}},
      },
    });

    expect(screen.getByRole('button', {name: 'Collapse 2 pinned'})).toBeInTheDocument();
  });

  it('hides the rendered pinned rows when the collapse button is clicked', async () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Collapse 1 pinned'}));

    expect(screen.queryByTestId('pinned-row-log-1')).not.toBeInTheDocument();
  });

  it('shows the rendered pinned rows again when the toggle button is clicked twice', async () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Collapse 1 pinned'}));
    await userEvent.click(screen.getByRole('button', {name: 'Expand 1 pinned'}));

    expect(screen.getByTestId('pinned-row-log-1')).toBeInTheDocument();
  });

  it('removes the rendered pinned rows when the Clear all button is clicked', async () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Clear all pins'}));

    expect(screen.queryByTestId('pinned-row-log-1')).not.toBeInTheDocument();
  });
});
