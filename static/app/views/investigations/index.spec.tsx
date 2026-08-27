import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import InvestigationsView from 'sentry/views/investigations';
import {
  investigationCandidatesQueryOptions,
  getInvestigationDetailQueryOptions,
  investigationListQueryOptions,
} from 'sentry/views/investigations/api';
import type {
  InvestigationDetail,
  InvestigationListItem,
} from 'sentry/views/investigations/types';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const listUrl = '/organizations/org-slug/investigations/';

function renderView({
  renderOrganization = organization,
  query = {},
}: {query?: Record<string, string>; renderOrganization?: Organization} = {}) {
  const queryClient = makeTestQueryClient();
  const result = render(<InvestigationsView />, {
    additionalWrapper: ({children}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    organization: renderOrganization,
    initialRouterConfig: {
      location: {
        pathname: '/organizations/org-slug/explore/investigations/',
        query,
      },
    },
  });

  return {...result, queryClient};
}

function InvestigationFixture(
  overrides: Partial<InvestigationListItem> = {}
): InvestigationListItem {
  return {
    id: '1',
    title: 'Database latency investigation',
    status: 'active',
    sourceType: 'manual',
    createdBy: '1',
    dateCreated: '2026-08-13T20:00:00Z',
    dateUpdated: '2026-08-13T21:00:00Z',
    version: 3,
    blockCount: 4,
    isFavorited: false,
    summary: null,
    summaryDescription: null,
    titleGeneration: {status: null},
    ...overrides,
  };
}

describe('Explore Investigations', () => {
  beforeEach(() => {
    jest.spyOn(indicators, 'addSuccessMessage').mockImplementation();
    jest.spyOn(indicators, 'addErrorMessage').mockImplementation();
    ConfigStore.set('customerDomain', null);
  });

  it('shows the standard feature-disabled state without the feature', () => {
    renderView({
      renderOrganization: OrganizationFixture({features: []}),
    });

    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Search Investigations')
    ).not.toBeInTheDocument();
  });

  it('shows the feature-disabled state for a closed-membership organization', () => {
    const listRequest = MockApiClient.addMockResponse({url: listUrl, body: []});

    renderView({
      renderOrganization: OrganizationFixture({
        features: ['investigations'],
        openMembership: false,
      }),
    });

    expect(
      screen.getByText(
        'Investigations are only available to organizations with open membership.'
      )
    ).toBeInTheDocument();
    expect(listRequest).not.toHaveBeenCalled();
  });

  it('renders loading and populated table states without unsupported controls', async () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'org-slug',
      organizationUrl: 'https://org-slug.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });

    renderView();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', {name: 'Database latency investigation'})
    ).toHaveAttribute('href', '/explore/investigations/1/');
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('All Projects')).not.toBeInTheDocument();
    expect(screen.queryByText('All Environments')).not.toBeInTheDocument();
  });

  it('renders the dashboard-style empty state', async () => {
    MockApiClient.addMockResponse({url: listUrl, body: []});

    renderView();

    expect(
      await screen.findByText('Sorry, no investigations match your filters.')
    ).toBeInTheDocument();
  });

  it('renders the route error state', async () => {
    MockApiClient.addMockResponse({url: listUrl, statusCode: 500});

    renderView();

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('syncs search to the URL and clears the cursor', async () => {
    MockApiClient.addMockResponse({url: listUrl, body: []});

    const {router} = renderView({query: {cursor: '123:0:0'}});
    await userEvent.type(screen.getByPlaceholderText('Search Investigations'), 'latency');
    await userEvent.keyboard('{Enter}');

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/investigations/'
    );
    expect(router.location.query).toEqual({query: 'latency'});
  });

  it('fetches the active list using URL search and cursor values', async () => {
    const listRequest = MockApiClient.addMockResponse({url: listUrl, body: []});

    renderView({query: {query: 'latency', cursor: '123:0:0'}});
    await screen.findByText('Sorry, no investigations match your filters.');

    expect(listRequest).toHaveBeenCalledWith(
      listUrl,
      expect.objectContaining({
        query: {status: 'active', query: 'latency', cursor: '123:0:0'},
      })
    );
  });

  it('uses the collection Link header for pagination', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
      headers: {
        Link: getPaginationPageLink({numRows: 20, pageSize: 10, offset: 0}),
      },
    });

    const {router} = renderView();
    await userEvent.click(await screen.findByLabelText('Next'));

    expect(router.location.query).toEqual({cursor: '0:10:0'});
  });

  it('prefetches the investigation when opening it', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    const detailRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/',
      body: {
        ...InvestigationFixture(),
        blocks: [],
        filters: {},
        parameters: [],
        projectIds: [],
        source: {type: 'manual', ref: {}, revision: null},
        template: null,
        titleGeneration: {status: null},
      },
    });

    renderView();
    await userEvent.click(
      await screen.findByRole('link', {name: 'Database latency investigation'})
    );

    await waitFor(() => expect(detailRequest).toHaveBeenCalledTimes(1));
  });

  it('creates an untitled investigation and opens it', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [],
    });
    const createRequest = MockApiClient.addMockResponse({
      url: listUrl,
      method: 'POST',
      body: InvestigationFixture({title: 'Untitled investigation'}),
    });

    const {queryClient, router} = renderView();
    const unrelatedOptions = getInvestigationDetailQueryOptions('org-slug', 'existing');
    const unrelatedDetail = InvestigationFixture({id: 'existing'});
    queryClient.setQueryData(unrelatedOptions.queryKey, {
      headers: {},
      json: unrelatedDetail,
    });
    await screen.findByText('Sorry, no investigations match your filters.');
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture({title: 'Untitled investigation'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/',
      body: InvestigationFixture({title: 'Untitled investigation'}),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Launch investigation'}));

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        listUrl,
        expect.objectContaining({data: {title: 'Untitled investigation'}})
      )
    );
    expect(await screen.findByText('Untitled investigation')).toBeInTheDocument();
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/investigations/1/'
    );
    expect(queryClient.getQueryData(unrelatedOptions.queryKey)?.json).toBe(
      unrelatedDetail
    );
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Investigation created.');
  });

  it('refreshes running title and summary generation in the list', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [
        InvestigationFixture({
          title: 'Untitled investigation',
          titleGeneration: {status: 'running'},
        }),
      ],
    });

    const {queryClient} = renderView();
    await screen.findByText('Untitled investigation');
    const completedRequest = MockApiClient.addMockResponse({
      url: listUrl,
      body: [
        InvestigationFixture({
          title: 'Checkout errors across releases',
          summary: 'Errors rose across releases',
          summaryDescription: 'All active releases increased together.',
          titleGeneration: {status: 'completed'},
        }),
      ],
    });

    expect(
      await screen.findByText('Checkout errors across releases', {}, {timeout: 3000})
    ).toBeInTheDocument();
    expect(completedRequest).toHaveBeenCalled();
    expect(
      queryClient.getQueryData(
        investigationListQueryOptions({organizationSlug: 'org-slug'}).queryKey
      )?.json[0]
    ).toEqual(
      expect.objectContaining({
        summary: 'Errors rose across releases',
        summaryDescription: 'All active releases increased together.',
      })
    );
  });

  it('toggles an investigation favorite and refreshes the list', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    const favoriteRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/favorite/',
      method: 'PUT',
    });

    renderView();
    await screen.findByLabelText('Favorite Database latency investigation');
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture({isFavorited: true})],
    });
    await userEvent.click(
      screen.getByLabelText('Favorite Database latency investigation')
    );

    await waitFor(() =>
      expect(favoriteRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/investigations/1/favorite/',
        expect.objectContaining({data: {shouldFavorite: true}})
      )
    );
    expect(
      await screen.findByLabelText('Unfavorite Database latency investigation')
    ).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture({isFavorited: false})],
    });
    await userEvent.click(
      screen.getByLabelText('Unfavorite Database latency investigation')
    );
    await waitFor(() =>
      expect(favoriteRequest).toHaveBeenLastCalledWith(
        '/organizations/org-slug/investigations/1/favorite/',
        expect.objectContaining({data: {shouldFavorite: false}})
      )
    );
    expect(
      await screen.findByLabelText('Favorite Database latency investigation')
    ).toBeInTheDocument();
  });

  it('updates a cached investigation after favoriting it', async () => {
    const investigation = InvestigationFixture();
    MockApiClient.addMockResponse({url: listUrl, body: [investigation]});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/favorite/',
      method: 'PUT',
    });

    const {queryClient} = renderView();
    const detailOptions = getInvestigationDetailQueryOptions('org-slug', '1');
    queryClient.setQueryData(detailOptions.queryKey, {
      headers: {Link: 'preserved'},
      json: investigation satisfies InvestigationDetail,
    });
    await userEvent.click(
      await screen.findByLabelText('Favorite Database latency investigation')
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(detailOptions.queryKey)).toEqual({
        headers: {Link: 'preserved'},
        json: {...investigation, isFavorited: true},
      })
    );
  });

  it('duplicates from the overflow menu', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    const duplicateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/duplicate/',
      method: 'POST',
      body: InvestigationFixture({id: '2'}),
    });

    const {queryClient} = renderView();
    const unrelatedOptions = getInvestigationDetailQueryOptions('org-slug', 'existing');
    const unrelatedDetail = InvestigationFixture({id: 'existing'});
    queryClient.setQueryData(unrelatedOptions.queryKey, {
      headers: {},
      json: unrelatedDetail,
    });
    await screen.findByText('Database latency investigation');
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [
        InvestigationFixture(),
        InvestigationFixture({id: '2', title: 'Database latency investigation copy'}),
      ],
    });
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Duplicate'}));

    await waitFor(() => expect(duplicateRequest).toHaveBeenCalled());
    expect(
      await screen.findByText('Database latency investigation copy')
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(unrelatedOptions.queryKey)?.json).toBe(
      unrelatedDetail
    );
  });

  it('copies the investigation link from the overflow menu', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {writeText},
      writable: true,
    });
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });

    renderView();
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Copy link'}));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/organizations/org-slug/explore/investigations/1/`
      )
    );
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Investigation link copied.'
    );
  });

  it('deletes only after confirmation and sends the current version', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/',
      method: 'DELETE',
    });

    renderView();
    await screen.findByText('Database latency investigation');
    MockApiClient.addMockResponse({url: listUrl, body: []});
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    expect(deleteRequest).not.toHaveBeenCalled();
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(deleteRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/investigations/1/',
        expect.objectContaining({data: {investigationVersion: 3}})
      )
    );
    await waitFor(() =>
      expect(screen.queryByText('Database latency investigation')).not.toBeInTheDocument()
    );
  });

  it('removes the deleted investigation from the detail cache', async () => {
    const investigation = InvestigationFixture();
    MockApiClient.addMockResponse({url: listUrl, body: [investigation]});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/',
      method: 'DELETE',
    });

    const {queryClient} = renderView();
    const detailOptions = getInvestigationDetailQueryOptions('org-slug', '1');
    queryClient.setQueryData(detailOptions.queryKey, {
      headers: {},
      json: investigation satisfies InvestigationDetail,
    });
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(queryClient.getQueryData(detailOptions.queryKey)).toBeUndefined()
    );
  });

  it('invalidates breached-metric entry points after deletion', async () => {
    const investigation = InvestigationFixture();
    MockApiClient.addMockResponse({url: listUrl, body: [investigation]});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/',
      method: 'DELETE',
    });

    const {queryClient} = renderView();
    const candidateOptions = investigationCandidatesQueryOptions({
      organizationSlug: 'org-slug',
      sources: [
        {
          type: 'metric_open_period',
          ref: {groupId: '123', openPeriodId: '456'},
        },
      ],
    });
    queryClient.setQueryData(candidateOptions.queryKey, {
      json: {items: [{status: 'view', investigationId: '1'}]},
      headers: {},
    });
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(queryClient.getQueryState(candidateOptions.queryKey)?.isInvalidated).toBe(
        true
      )
    );
  });

  it.each([
    [
      'create',
      'Launch investigation',
      listUrl,
      'POST',
      'Unable to create investigation.',
    ],
    [
      'favorite',
      'Favorite Database latency investigation',
      '/organizations/org-slug/investigations/1/favorite/',
      'PUT',
      'Unable to update investigation favorite.',
    ],
  ])('reports a %s failure', async (_name, buttonName, url, method, message) => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    MockApiClient.addMockResponse({url, method, statusCode: 500});

    renderView();
    await userEvent.click(await screen.findByRole('button', {name: buttonName}));

    await waitFor(() => expect(indicators.addErrorMessage).toHaveBeenCalledWith(message));
  });

  it('reports a duplicate failure', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/duplicate/',
      method: 'POST',
      statusCode: 500,
    });

    renderView();
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Duplicate'}));

    await waitFor(() =>
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Unable to duplicate investigation.'
      )
    );
  });

  it('reports a delete failure', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/1/',
      method: 'DELETE',
      statusCode: 500,
    });

    renderView();
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Unable to delete investigation.'
      )
    );
  });
});
