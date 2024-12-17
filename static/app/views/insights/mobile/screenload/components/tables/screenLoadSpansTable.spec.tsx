import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ScreenLoadSpansTable} from 'sentry/views/insights/mobile/screenload/components/tables/screenLoadSpansTable';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('ScreenLoadSpansTable', function () {
  const organization = OrganizationFixture({
    features: ['insights-initial-modules'],
  });

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/screens/',
    query: {},
    search: '',
    state: undefined,
  } as Location);

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  let eventsMock;
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {},
        data: [],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders table with the right columns', async function () {
    render(
      <ScreenLoadSpansTable
        transaction="MainActivity"
        primaryRelease="io.sentry.samples.android@7.0.0+2"
        secondaryRelease="io.sentry.samples.android@6.27.0+2"
      />,
      {organization}
    );

    expect(eventsMock).toHaveBeenCalledTimes(2);

    // Span op selector
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spansMetrics',
          environment: [],
          field: ['span.op', 'count()'],
          per_page: 25,
          project: [],
          query:
            'transaction.op:ui.load transaction:MainActivity span.op:[file.read,file.write,ui.load,http.client,db,db.sql.room,db.sql.query,db.sql.transaction] has:span.description ( release:io.sentry.samples.android@7.0.0+2 OR release:io.sentry.samples.android@6.27.0+2 )',
          referrer: 'api.starfish.get-span-operations',
          statsPeriod: '14d',
        }),
      })
    );

    // Spans table
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'project.id',
            'span.op',
            'span.group',
            'span.description',
            'avg_if(span.self_time,release,io.sentry.samples.android@7.0.0+2)',
            'avg_if(span.self_time,release,io.sentry.samples.android@6.27.0+2)',
            'ttid_contribution_rate()',
            'ttfd_contribution_rate()',
            'count()',
            'time_spent_percentage()',
            'sum(span.self_time)',
          ],
          per_page: 25,
          project: [],
          query:
            'transaction.op:ui.load transaction:MainActivity has:span.description span.op:[file.read,file.write,ui.load,http.client,db,db.sql.room,db.sql.query,db.sql.transaction] ( release:io.sentry.samples.android@7.0.0+2 OR release:io.sentry.samples.android@6.27.0+2 )',
          referrer: 'api.starfish.mobile-span-table',
          sort: '-time_spent_percentage()',
          statsPeriod: '14d',
        }),
      })
    );

    const header = await screen.findAllByTestId('grid-head-row');
    const headerCells = within(header[0]).getAllByTestId('grid-head-cell');
    const headerCell = headerCells[4];
    expect(headerCell).toHaveTextContent('Affects TTID');
    expect(await screen.findByRole('link', {name: 'Affects TTID'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/mobile/screens/?spansSort=-ttid_contribution_rate%28%29'
    );
  });

  it('sorts ttfd contribution', async function () {
    jest.mocked(useLocation).mockReturnValue({
      action: 'PUSH',
      hash: '',
      key: '',
      pathname: '/organizations/org-slug/performance/mobile/screens/',
      query: {spansSort: '-ttid_contribution_rate()'},
      search: '',
      state: undefined,
    } as Location);

    render(
      <ScreenLoadSpansTable
        transaction="MainActivity"
        primaryRelease="io.sentry.samples.android@7.0.0+2"
        secondaryRelease="io.sentry.samples.android@6.27.0+2"
      />,
      {organization}
    );

    const header = await screen.findAllByTestId('grid-head-row');
    const headerCells = within(header[0]).getAllByTestId('grid-head-cell');
    const headerCell = headerCells[4];
    expect(headerCell).toHaveTextContent('Affects TTID');
    expect(await screen.findByRole('link', {name: 'Affects TTID'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/mobile/screens/?spansSort=-ttfd_contribution_rate%28%29'
    );
  });
});
