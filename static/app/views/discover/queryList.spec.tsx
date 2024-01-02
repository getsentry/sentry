import {browserHistory} from 'react-router';
import {DiscoverSavedQuery} from 'sentry-fixture/discover';
import {Organization} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DisplayModes} from 'sentry/utils/discover/types';
import {DashboardWidgetSource, DisplayType} from 'sentry/views/dashboards/types';
import QueryList from 'sentry/views/discover/queryList';

jest.mock('sentry/actionCreators/modal');

describe('Discover > QueryList', function () {
  let location,
    savedQueries,
    organization,
    deleteMock,
    duplicateMock,
    queryChangeMock,
    updateHomepageMock,
    eventsStatsMock,
    wrapper;

  const {router, routerContext} = initializeOrg();

  beforeAll(async function () {
    await import('sentry/components/modals/widgetBuilder/addToDashboardModal');
  });

  beforeEach(function () {
    organization = Organization({
      features: ['discover-basic', 'discover-query'],
    });
    savedQueries = [
      DiscoverSavedQuery(),
      DiscoverSavedQuery({name: 'saved query 2', id: '2'}),
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

    location = {
      pathname: '/organizations/org-slug/discover/queries/',
      query: {cursor: '0:1:1', statsPeriod: '14d'},
    };
    queryChangeMock = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    wrapper && wrapper.unmount();
    wrapper = null;
  });

  it('renders an empty list', function () {
    render(
      <QueryList
        router={RouterFixture()}
        organization={organization}
        savedQueries={[]}
        savedQuerySearchQuery="no matches"
        pageLinks=""
        renderPrebuilt={false}
        onQueryChange={queryChangeMock}
        location={location}
      />
    );

    expect(screen.getByText('No saved queries match that filter')).toBeInTheDocument();
  });

  it('renders pre-built queries and saved ones', function () {
    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={organization}
        savedQueries={savedQueries}
        renderPrebuilt
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
    );

    expect(screen.getAllByTestId(/card-.*/)).toHaveLength(5);
  });

  it('can duplicate and trigger change callback', async function () {
    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        renderPrebuilt={false}
        onQueryChange={queryChangeMock}
        location={location}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card!);
    expect(withinCard.getByText('Saved query #1')).toBeInTheDocument();

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    await userEvent.click(withinCard.getByText('Duplicate Query'));

    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: location.pathname,
        query: {},
      });
    });

    expect(duplicateMock).toHaveBeenCalled();
    expect(queryChangeMock).toHaveBeenCalled();
  });

  it('can delete and trigger change callback', async function () {
    render(
      <QueryList
        savedQuerySearchQuery=""
        renderPrebuilt={false}
        router={RouterFixture()}
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(1);
    const withinCard = within(card!);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    await userEvent.click(withinCard.getByText('Delete Query'));

    await waitFor(() => {
      expect(queryChangeMock).toHaveBeenCalled();
    });

    expect(deleteMock).toHaveBeenCalled();
  });

  it('redirects to Discover on card click', async function () {
    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={organization}
        savedQueries={savedQueries}
        pageLinks=""
        renderPrebuilt={false}
        onQueryChange={queryChangeMock}
        location={location}
      />,
      {context: routerContext}
    );

    await userEvent.click(screen.getAllByTestId(/card-*/).at(0)!);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/organizations/org-slug/discover/results/',
      query: {id: '1', statsPeriod: '14d'},
    });
  });

  it('can redirect on last query deletion', async function () {
    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        renderPrebuilt={false}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
      />,
      {context: routerContext}
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card!);

    await userEvent.click(withinCard.getByTestId('menu-trigger'));
    await userEvent.click(withinCard.getByText('Delete Query'));

    expect(deleteMock).toHaveBeenCalled();
    expect(queryChangeMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: location.pathname,
        query: {cursor: undefined, statsPeriod: '14d'},
      });
    });
  });

  it('renders Add to Dashboard in context menu', async function () {
    const featuredOrganization = Organization({
      features: ['dashboards-edit'],
    });

    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={featuredOrganization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        onQueryChange={queryChangeMock}
        renderPrebuilt={false}
        location={location}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card!);

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

  it('only renders Delete Query and Duplicate Query in context menu', async function () {
    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        pageLinks=""
        renderPrebuilt={false}
        onQueryChange={queryChangeMock}
        location={location}
      />
    );

    const card = screen.getAllByTestId(/card-*/).at(0)!;
    const withinCard = within(card!);

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

  it('passes yAxis from the savedQuery to MiniGraph', async function () {
    const featuredOrganization = Organization({
      features: ['dashboards-edit'],
    });
    const yAxis = ['count()', 'failure_count()'];
    const savedQueryWithMultiYAxis = {
      ...savedQueries.slice(1)[0],
      yAxis,
    };

    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={featuredOrganization}
        savedQueries={[savedQueryWithMultiYAxis]}
        pageLinks=""
        renderPrebuilt={false}
        onQueryChange={queryChangeMock}
        location={location}
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

  it('Set as Default updates the homepage query', async function () {
    render(
      <QueryList
        savedQuerySearchQuery=""
        router={RouterFixture()}
        organization={organization}
        savedQueries={savedQueries.slice(1)}
        renderPrebuilt={false}
        pageLinks=""
        onQueryChange={queryChangeMock}
        location={location}
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

  describe('Add to Dashboard modal', () => {
    it('opens a modal with the correct params for Top 5 chart', async function () {
      const featuredOrganization = Organization({
        features: ['dashboards-edit'],
      });
      render(
        <QueryList
          savedQuerySearchQuery=""
          router={RouterFixture()}
          organization={featuredOrganization}
          renderPrebuilt={false}
          savedQueries={[
            DiscoverSavedQuery({
              display: DisplayModes.TOP5,
              orderby: 'test',
              fields: ['test', 'count()'],
              yAxis: ['count()'],
            }),
          ]}
          pageLinks=""
          onQueryChange={queryChangeMock}
          location={location}
        />
      );

      const contextMenu = await screen.findByTestId('menu-trigger');
      expect(contextMenu).toBeInTheDocument();

      expect(screen.queryByTestId('add-to-dashboard')).not.toBeInTheDocument();

      await userEvent.click(contextMenu);

      const addToDashboardMenuItem = await screen.findByTestId('add-to-dashboard');

      await userEvent.click(addToDashboardMenuItem);

      await waitFor(() => {
        expect(openAddToDashboardModal).toHaveBeenCalledWith(
          expect.objectContaining({
            widget: {
              title: 'Saved query #1',
              displayType: DisplayType.AREA,
              limit: 5,
              queries: [
                {
                  aggregates: ['count()'],
                  columns: ['test'],
                  conditions: '',
                  fields: ['test', 'count()', 'count()'],
                  name: '',
                  orderby: 'test',
                },
              ],
            },
            widgetAsQueryParams: expect.objectContaining({
              defaultTableColumns: ['test', 'count()'],
              defaultTitle: 'Saved query #1',
              defaultWidgetQuery:
                'name=&aggregates=count()&columns=test&fields=test%2Ccount()%2Ccount()&conditions=&orderby=test',
              displayType: DisplayType.AREA,
              source: DashboardWidgetSource.DISCOVERV2,
            }),
          })
        );
      });
    });

    it('opens a modal with the correct params for other chart', async function () {
      const featuredOrganization = Organization({
        features: ['dashboards-edit'],
      });
      render(
        <QueryList
          savedQuerySearchQuery=""
          router={RouterFixture()}
          renderPrebuilt={false}
          organization={featuredOrganization}
          savedQueries={[
            DiscoverSavedQuery({
              display: DisplayModes.DEFAULT,
              orderby: 'count()',
              fields: ['test', 'count()'],
              yAxis: ['count()'],
            }),
          ]}
          pageLinks=""
          onQueryChange={queryChangeMock}
          location={location}
        />
      );

      const contextMenu = await screen.findByTestId('menu-trigger');
      expect(contextMenu).toBeInTheDocument();

      expect(screen.queryByTestId('add-to-dashboard')).not.toBeInTheDocument();

      await userEvent.click(contextMenu);

      const addToDashboardMenuItem = await screen.findByTestId('add-to-dashboard');

      await userEvent.click(addToDashboardMenuItem);

      await waitFor(() => {
        expect(openAddToDashboardModal).toHaveBeenCalledWith(
          expect.objectContaining({
            widget: {
              title: 'Saved query #1',
              displayType: DisplayType.LINE,
              queries: [
                {
                  aggregates: ['count()'],
                  columns: [],
                  conditions: '',
                  fields: ['count()'],
                  name: '',
                  // Orderby gets dropped because ordering only applies to
                  // Top-N and tables
                  orderby: '',
                },
              ],
            },
            widgetAsQueryParams: expect.objectContaining({
              defaultTableColumns: ['test', 'count()'],
              defaultTitle: 'Saved query #1',
              defaultWidgetQuery:
                'name=&aggregates=count()&columns=&fields=count()&conditions=&orderby=',
              displayType: DisplayType.LINE,
              source: DashboardWidgetSource.DISCOVERV2,
            }),
          })
        );
      });
    });
  });
});
