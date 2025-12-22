import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ScreenLoadSpansTable} from 'sentry/views/insights/mobile/screenload/components/tables/screenLoadSpansTable';

describe('ScreenLoadSpansTable', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });

  let eventsMock: jest.Mock;
  beforeEach(() => {
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

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders table with the right columns', async () => {
    render(
      <ScreenLoadSpansTable
        transaction="MainActivity"
        primaryRelease="io.sentry.samples.android@7.0.0+2"
      />,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/performance/mobile/screens/',
          location: {
            pathname: '/organizations/org-slug/performance/mobile/screens/',
          },
        },
      }
    );

    expect(eventsMock).toHaveBeenCalledTimes(1);

    // Span table data
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          environment: [],
          field: [
            'project.id',
            'span.op',
            'span.group',
            'span.description',
            'ttid_contribution_rate()',
            'ttfd_contribution_rate()',
            'count()',
            'sum(span.self_time)',
            'avg(span.self_time)',
          ],
          per_page: 25,
          project: [],
          query:
            'transaction.op:[ui.load,navigation] transaction:MainActivity has:span.description span.op:[file.read,file.write,ui.load,navigation,http.client,db,db.sql.room,db.sql.query,db.sql.transaction] release:io.sentry.samples.android@7.0.0+2',
          referrer: 'api.insights.mobile-span-table',
          sort: '-sum(span.self_time)',
          statsPeriod: '14d',
        }),
      })
    );

    const header = await screen.findAllByTestId('grid-head-row');
    const headerCells = within(header[0]!).getAllByTestId('grid-head-cell');
    const headerCell = headerCells[3];
    expect(headerCell).toHaveTextContent('Affects');
    expect(await screen.findByRole('link', {name: 'Affects'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/mobile/screens/?spansSort=-ttid_contribution_rate%28%29'
    );
  });

  it('sorts ttfd contribution', async () => {
    render(
      <ScreenLoadSpansTable
        transaction="MainActivity"
        primaryRelease="io.sentry.samples.android@7.0.0+2"
      />,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/performance/mobile/screens/',
          location: {
            pathname: '/organizations/org-slug/performance/mobile/screens/',
            query: {spansSort: '-ttid_contribution_rate()'},
          },
        },
      }
    );

    const header = await screen.findAllByTestId('grid-head-row');
    const headerCells = within(header[0]!).getAllByTestId('grid-head-cell');
    const headerCell = headerCells[3];
    expect(headerCell).toHaveTextContent('Affects');
    expect(await screen.findByRole('link', {name: 'Affects'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/mobile/screens/?spansSort=-ttfd_contribution_rate%28%29'
    );
  });

  it('renders single duration column', async () => {
    render(
      <ScreenLoadSpansTable
        transaction="MainActivity"
        primaryRelease="io.sentry.samples.android@7.0.0+2"
      />,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/performance/mobile/screens/',
          location: {
            pathname: '/organizations/org-slug/performance/mobile/screens/',
          },
        },
      }
    );

    const header = await screen.findAllByTestId('grid-head-row');
    const headerCells = within(header[0]!).getAllByTestId('grid-head-cell');

    // Should show single "Avg Duration" column, not comparison columns
    const headerTexts = headerCells.map(cell => cell.textContent);
    expect(headerTexts).toContain('Avg Duration');

    // Verify API call uses single avg field, not comparison fields
    expect(eventsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          field: expect.arrayContaining(['avg(span.self_time)']),
        }),
      })
    );
  });

  it('renders single duration column when no releases provided', async () => {
    render(<ScreenLoadSpansTable transaction="MainActivity" />, {
      organization,
      initialRouterConfig: {
        route: '/organizations/:orgId/performance/mobile/screens/',
        location: {
          pathname: '/organizations/org-slug/performance/mobile/screens/',
        },
      },
    });

    const header = await screen.findAllByTestId('grid-head-row');
    const headerCells = within(header[0]!).getAllByTestId('grid-head-cell');

    // Should show single "Avg Duration" column, not comparison columns
    const headerTexts = headerCells.map(cell => cell.textContent);
    expect(headerTexts).toContain('Avg Duration');
    expect(headerTexts).not.toContain('Avg Duration (Primary)');
    expect(headerTexts).not.toContain('Avg Duration (Secondary)');

    // Verify API call uses single avg field, not comparison fields
    expect(eventsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          field: expect.arrayContaining(['avg(span.self_time)']),
        }),
      })
    );
  });
});
