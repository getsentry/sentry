import {DiscoverSavedQueryFixture} from 'sentry-fixture/discover';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DisplayModes, SavedQueryDatasets} from 'sentry/utils/discover/types';
import QueryList from 'sentry/views/discover/queryList';

jest.mock('sentry/actionCreators/modal');

describe('Discover > QueryList', () => {
  let location: ReturnType<typeof LocationFixture>;
  let savedQueries: Array<ReturnType<typeof DiscoverSavedQueryFixture>>;
  let organization: ReturnType<typeof OrganizationFixture>;
  let deleteMock: jest.Mock;
  let duplicateMock: jest.Mock;
  let updateHomepageMock: jest.Mock;
  let eventsStatsMock: jest.Mock;
  const refetchSavedQueries = jest.fn();

  beforeAll(async () => {
    await import('sentry/components/modals/widgetBuilder/addToDashboardModal');
  });

  beforeEach(() => {
    jest.resetAllMocks();
    organization = OrganizationFixture({
      features: ['discover-basic', 'discover-query'],
    });
    savedQueries = [
      DiscoverSavedQueryFixture(),
      DiscoverSavedQueryFixture({name: 'saved query 2', id: '2'}),
    ];

    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      statusCode: 200,
      body: {data: []},
    });

    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/2/',
      method: 'DELETE',
      statusCode: 200,
      body: {},
    });

    duplicateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/',
      method: 'POST',
      body: {
        id: '3',
        name: 'Saved query copy',
      },
    });

    updateHomepageMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'PUT',
      statusCode: 204,
    });

    location = LocationFixture({
      pathname: '/organizations/org-slug/discover/queries/',
      query: {cursor: '0:1:1', statsPeriod: '14d'},
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders an empty list', () => {
    render(
      <QueryList
        organization={organization}
        savedQueries={[]}
        savedQuerySearchQuery="no matches"
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />,
      {
        deprecatedRouterMocks: true,
      }
    );

    expect(screen.getByText('No saved queries match that filter')).toBeInTheDocument();
  });

  it('renders pre-built queries and saved ones', async () => {
    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={organization}
        savedQueries={savedQueries}
        renderPrebuilt
        pageLinks=""
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId(/card-.*/)).toHaveLength(5);
    });

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: {
          dataset: 'errors',
          environment: [],
          interval: '5m',
          partial: '1',
          project: [],
          query: '',
          referrer: 'api.discover.homepage.prebuilt',
          statsPeriod: '24h',
          yAxis: 'count()',
        },
      })
    );
  });

  it('renders pre-built queries with dataset', async () => {
    organization = OrganizationFixture({
      features: ['discover-basic', 'discover-query', 'performance-view'],
    });
    const {router} = render(
      <QueryList
        savedQuerySearchQuery=""
        organization={organization}
        savedQueries={[]}
        renderPrebuilt
        pageLinks=""
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId(/card-.*/)).toHaveLength(5);
    });

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'transactions',
          query: '',
          referrer: 'api.discover.homepage.prebuilt',
          statsPeriod: '24h',
          yAxis: 'count()',
        }),
      })
    );
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'errors',
          environment: [],
          field: ['url', 'count()', 'count_unique(issue)'],
          query: 'has:url',
          referrer: 'api.discover.homepage.prebuilt',
          statsPeriod: '24h',
          topEvents: 5,
          yAxis: 'count()',
        }),
      })
    );

    await userEvent.click(screen.getAllByTestId(/card-*/).at(0)!);
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/discover/results/'
    );
    expect(router.location.query).toEqual(
      expect.objectContaining({queryDataset: 'error-events'})
    );
  });

  it('passes dataset to the query if flag is enabled', async () => {
    const org = OrganizationFixture({
      features: ['discover-basic', 'discover-query'],
    });
    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={org}
        savedQueries={savedQueries}
        renderPrebuilt
        pageLinks=""
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId(/card-.*/)).toHaveLength(5);
    });

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: {
          environment: [],
          interval: '30m',
          partial: '1',
          project: [],
          query: '',
          referrer: 'api.discover.default-chart',
          statsPeriod: '14d',
          yAxis: ['count()'],
          dataset: 'transactions',
        },
      })
    );
  });

  it('can duplicate and trigger change callback', async () => {
    const {router} = render(
      <QueryList
        savedQuerySearchQuery=""
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card);
    expect(withinCard.getByText('Saved query #1')).toBeInTheDocument();

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    await userEvent.click(withinCard.getByText('Duplicate Query'));

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: location.pathname,
          query: {},
        })
      );
    });

    expect(duplicateMock).toHaveBeenCalled();
  });

  it('can delete and trigger change callback', async () => {
    render(
      <QueryList
        savedQuerySearchQuery=""
        renderPrebuilt={false}
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(1);
    const withinCard = within(card!);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    await userEvent.click(withinCard.getByText('Delete Query'));

    expect(deleteMock).toHaveBeenCalled();
    expect(refetchSavedQueries).toHaveBeenCalled();
  });

  it('redirects to Discover on card click', async () => {
    const {router} = render(
      <QueryList
        savedQuerySearchQuery=""
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    await userEvent.click(screen.getAllByTestId(/card-*/).at(0)!);
    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/explore/discover/results/',
        query: {id: '1', statsPeriod: '14d'},
      })
    );
  });

  it('can redirect on last query deletion', async () => {
    const {router} = render(
      <QueryList
        savedQuerySearchQuery=""
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        renderPrebuilt={false}
        pageLinks=""
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    await userEvent.click(withinCard.getByText('Delete Query'));

    expect(deleteMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(router.location.query).toEqual(
        expect.objectContaining({statsPeriod: '14d'})
      );
    });
    expect(router.location.query.cursor).toBeUndefined();
  });

  it('renders Add to Dashboard in context menu', async () => {
    const featuredOrganization = OrganizationFixture({
      features: ['dashboards-edit'],
    });

    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={featuredOrganization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));

    expect(
      screen.getByRole('menuitemradio', {name: 'Add to Dashboard'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Set as Default'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Duplicate Query'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Delete Query'})).toBeInTheDocument();
  });

  it('only renders Delete Query and Duplicate Query in context menu', async () => {
    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));

    expect(
      screen.queryByRole('menuitemradio', {name: 'Add to Dashboard'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Set as Default'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Duplicate Query'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Delete Query'})).toBeInTheDocument();
  });

  it('passes yAxis from the savedQuery to MiniGraph', async () => {
    const featuredOrganization = OrganizationFixture({
      features: ['dashboards-edit'],
    });
    const yAxis = ['count()', 'failure_count()'];
    const savedQueryWithMultiYAxis = {
      ...savedQueries.slice(1)[0]!,
      yAxis,
    };

    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={featuredOrganization}
        savedQueries={[savedQueryWithMultiYAxis]}
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const chart = await screen.findByTestId('area-chart');
    expect(chart).toBeInTheDocument();
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: ['count()', 'failure_count()'],
        }),
      })
    );
  });

  it('Set as Default updates the homepage query', async () => {
    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        renderPrebuilt={false}
        pageLinks=""
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    await userEvent.click(screen.getByTestId('menu-trigger'));
    await userEvent.click(screen.getByText('Set as Default'));
    expect(updateHomepageMock).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/homepage/',
      expect.objectContaining({
        data: expect.objectContaining({fields: ['test'], range: '14d'}),
      })
    );
  });

  it('disabled duplicate for transaction queries with deprecation flag', async () => {
    const featuredOrganization = OrganizationFixture({
      features: ['dashboards-edit', 'discover-saved-queries-deprecation'],
    });

    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={featuredOrganization}
        savedQueries={[
          DiscoverSavedQueryFixture({
            display: DisplayModes.DEFAULT,
            orderby: 'count()',
            fields: ['test', 'count()'],
            yAxis: ['count()'],
            queryDataset: SavedQueryDatasets.TRANSACTIONS,
          }),
        ]}
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    const duplicateMenuItem = await screen.findByRole('menuitemradio', {
      name: 'Duplicate Query',
    });

    expect(duplicateMenuItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not disable duplicate for error queries with deprecation flag', async () => {
    const featuredOrganization = OrganizationFixture({
      features: ['dashboards-edit', 'discover-saved-queries-deprecation'],
    });

    render(
      <QueryList
        savedQuerySearchQuery=""
        organization={featuredOrganization}
        savedQueries={[
          DiscoverSavedQueryFixture({
            display: DisplayModes.DEFAULT,
            orderby: 'count()',
            fields: ['test', 'count()'],
            yAxis: ['count()'],
            queryDataset: SavedQueryDatasets.ERRORS,
          }),
        ]}
        pageLinks=""
        renderPrebuilt={false}
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    const duplicateMenuItem = await screen.findByRole('menuitemradio', {
      name: 'Duplicate Query',
    });

    expect(duplicateMenuItem).not.toHaveAttribute('aria-disabled');
  });

  describe('Add to Dashboard modal', () => {
    it('opens a modal with the correct params for Top 5 chart', async () => {
      const featuredOrganization = OrganizationFixture({
        features: ['dashboards-edit'],
      });
      render(
        <QueryList
          savedQuerySearchQuery=""
          organization={featuredOrganization}
          renderPrebuilt={false}
          savedQueries={[
            DiscoverSavedQueryFixture({
              display: DisplayModes.TOP5,
              orderby: 'test',
              fields: ['test', 'count()'],
              yAxis: ['count()'],
            }),
          ]}
          pageLinks=""
          location={location}
          refetchSavedQueries={refetchSavedQueries}
        />
      );

      const contextMenu = await screen.findByTestId('menu-trigger');
      expect(contextMenu).toBeInTheDocument();

      expect(
        screen.queryByRole('menuitemradio', {name: 'Add to Dashboard'})
      ).not.toBeInTheDocument();

      await userEvent.click(contextMenu);

      const addToDashboardMenuItem = await screen.findByRole('menuitemradio', {
        name: 'Add to Dashboard',
      });

      await userEvent.click(addToDashboardMenuItem);

      await waitFor(() => {
        expect(openAddToDashboardModal).toHaveBeenCalledWith(
          expect.objectContaining({
            widget: {
              displayType: 'area',
              interval: undefined,
              limit: 5,
              queries: [
                {
                  aggregates: ['count()'],
                  columns: ['test'],
                  conditions: '',
                  fields: ['test'],
                  name: '',
                  orderby: 'test',
                },
              ],
              title: 'Saved query #1',
              widgetType: 'transaction-like',
            },
          })
        );
      });
    });

    it('opens a modal with the correct params for other chart', async () => {
      const featuredOrganization = OrganizationFixture({
        features: ['dashboards-edit'],
      });
      render(
        <QueryList
          savedQuerySearchQuery=""
          renderPrebuilt={false}
          organization={featuredOrganization}
          savedQueries={[
            DiscoverSavedQueryFixture({
              display: DisplayModes.DEFAULT,
              orderby: 'count()',
              fields: ['test', 'count()'],
              yAxis: ['count()'],
              queryDataset: SavedQueryDatasets.TRANSACTIONS,
            }),
          ]}
          pageLinks=""
          location={location}
          refetchSavedQueries={refetchSavedQueries}
        />
      );

      const contextMenu = await screen.findByTestId('menu-trigger');
      expect(contextMenu).toBeInTheDocument();

      expect(
        screen.queryByRole('menuitemradio', {name: 'Add to Dashboard'})
      ).not.toBeInTheDocument();

      await userEvent.click(contextMenu);

      const addToDashboardMenuItem = await screen.findByRole('menuitemradio', {
        name: 'Add to Dashboard',
      });

      await userEvent.click(addToDashboardMenuItem);

      await waitFor(() => {
        expect(openAddToDashboardModal).toHaveBeenCalledWith(
          expect.objectContaining({
            widget: {
              displayType: 'area',
              interval: undefined,
              limit: undefined,
              queries: [
                {
                  aggregates: ['count()'],
                  columns: [],
                  conditions: '',
                  fields: [],
                  name: '',
                  orderby: '',
                },
              ],
              title: 'Saved query #1',
              widgetType: 'transaction-like',
            },
          })
        );
      });
    });

    it('disables Add to Dashboard for transaction queries with deprecation flag', async () => {
      const featuredOrganization = OrganizationFixture({
        features: ['dashboards-edit', 'discover-saved-queries-deprecation'],
      });
      render(
        <QueryList
          savedQuerySearchQuery=""
          organization={featuredOrganization}
          renderPrebuilt={false}
          savedQueries={[
            DiscoverSavedQueryFixture({
              display: DisplayModes.DEFAULT,
              orderby: 'count()',
              fields: ['test', 'count()'],
              yAxis: ['count()'],
              queryDataset: SavedQueryDatasets.TRANSACTIONS,
            }),
          ]}
          pageLinks=""
          location={location}
          refetchSavedQueries={refetchSavedQueries}
        />
      );

      const contextMenu = await screen.findByTestId('menu-trigger');
      expect(contextMenu).toBeInTheDocument();

      await userEvent.click(contextMenu);

      const addToDashboardMenuItem = await screen.findByRole('menuitemradio', {
        name: 'Add to Dashboard',
      });

      expect(addToDashboardMenuItem).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not disable Add to Dashboard for error queries with deprecation flag', async () => {
      const featuredOrganization = OrganizationFixture({
        features: ['dashboards-edit', 'discover-saved-queries-deprecation'],
      });
      render(
        <QueryList
          savedQuerySearchQuery=""
          organization={featuredOrganization}
          renderPrebuilt={false}
          savedQueries={[
            DiscoverSavedQueryFixture({
              display: DisplayModes.DEFAULT,
              orderby: 'count()',
              fields: ['test', 'count()'],
              yAxis: ['count()'],
              queryDataset: SavedQueryDatasets.ERRORS,
            }),
          ]}
          pageLinks=""
          location={location}
          refetchSavedQueries={refetchSavedQueries}
        />
      );

      const contextMenu = await screen.findByTestId('menu-trigger');
      expect(contextMenu).toBeInTheDocument();

      await userEvent.click(contextMenu);

      const addToDashboardMenuItem = await screen.findByRole('menuitemradio', {
        name: 'Add to Dashboard',
      });

      expect(addToDashboardMenuItem).not.toHaveAttribute('aria-disabled');
    });
  });

  it('passes dataset to open modal', async () => {
    const featuredOrganization = OrganizationFixture({
      features: ['dashboards-edit'],
    });
    render(
      <QueryList
        savedQuerySearchQuery=""
        renderPrebuilt={false}
        organization={featuredOrganization}
        savedQueries={[
          DiscoverSavedQueryFixture({
            display: DisplayModes.DEFAULT,
            orderby: 'count()',
            fields: ['test', 'count()'],
            yAxis: ['count()'],
            queryDataset: SavedQueryDatasets.TRANSACTIONS,
          }),
        ]}
        pageLinks=""
        location={location}
        refetchSavedQueries={refetchSavedQueries}
      />
    );

    const contextMenu = await screen.findByTestId('menu-trigger');
    expect(contextMenu).toBeInTheDocument();

    expect(
      screen.queryByRole('menuitemradio', {name: 'Add to Dashboard'})
    ).not.toBeInTheDocument();

    await userEvent.click(contextMenu);

    const addToDashboardMenuItem = await screen.findByRole('menuitemradio', {
      name: 'Add to Dashboard',
    });

    await userEvent.click(addToDashboardMenuItem);

    await waitFor(() => {
      expect(openAddToDashboardModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: {
            displayType: 'area',
            interval: undefined,
            limit: undefined,
            queries: [
              {
                aggregates: ['count()'],
                columns: [],
                conditions: '',
                fields: [],
                name: '',
                orderby: '',
              },
            ],
            title: 'Saved query #1',
            widgetType: 'transaction-like',
          },
        })
      );
    });
  });
});
