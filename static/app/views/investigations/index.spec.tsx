import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {toast} from '@sentry/scraps/toast';

import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import InvestigationsView from 'sentry/views/investigations';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

import {
  investigationCandidatesQueryOptions,
  getInvestigationDetailQueryOptions,
  investigationListQueryOptions,
} from './api';
import {InvestigationListItemFixture as InvestigationFixture} from './fixtures';
import type {InvestigationDetail} from './types';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const listUrl = '/organizations/org-slug/notebooks/';

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
        pathname: '/organizations/org-slug/seer/investigations/',
        query,
      },
    },
  });

  return {...result, queryClient};
}

describe('Explore Investigations', () => {
  beforeEach(() => {
    jest.spyOn(toast, 'success').mockImplementation();
    jest.spyOn(toast, 'error').mockImplementation();
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
    ).toHaveAttribute('href', '/seer/investigations/1/');
  });

  it('shows who or which automation triggered each investigation', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [
        InvestigationFixture({
          id: '1',
          trigger: {
            type: 'user',
            user: UserFixture({name: 'Ivy Sanders Schneider'}),
          },
        }),
        InvestigationFixture({
          id: '2',
          trigger: {
            type: 'automation',
            automation: {id: '7', name: null, strategy: 'breached_metric_investigation'},
            runId: '42',
          },
        }),
        InvestigationFixture({
          id: '3',
          trigger: {
            type: 'automation',
            automation: {id: '8', name: 'Telemetry audit', strategy: 'agentic_triage_v2'},
            runId: '43',
          },
        }),
      ],
    });

    renderView({
      renderOrganization: OrganizationFixture({
        features: ['investigations', 'seer-automations'],
        openMembership: true,
      }),
    });

    expect(await screen.findByText('Ivy Sanders Schneider')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Breached metrics · Run 42'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/automations/7/runs/'
    );
    expect(screen.getByRole('link', {name: 'Telemetry audit · Run 43'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/automations/8/runs/'
    );
  });

  it('does not link automations the organization cannot open', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [
        InvestigationFixture({
          trigger: {
            type: 'automation',
            automation: {id: '7', name: null, strategy: 'breached_metric_investigation'},
            runId: '42',
          },
        }),
      ],
    });

    renderView();

    expect(await screen.findByText('Breached metrics · Run 42')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Breached metrics · Run 42'})
    ).not.toBeInTheDocument();
  });

  it('shows the state of each investigation run', async () => {
    const statuses: Array<[string, string]> = [
      ['pending', 'Queued'],
      ['processing', 'Running'],
      ['awaiting_input', 'Needs input'],
      ['completed', 'Completed'],
      ['failed', 'Failed'],
      ['cancelled', 'Cancelled'],
    ];
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [
        InvestigationFixture({id: 'manual', title: 'manual'}),
        ...statuses.map(([status]) =>
          InvestigationFixture({
            id: status,
            title: status,
            orchestration: {
              heartbeatAt: null,
              notebookRevision: 1,
              phase: 'investigating',
              status,
            },
          })
        ),
      ],
    });

    renderView();

    await screen.findByRole('link', {name: 'manual'});
    const rows = screen.getAllByRole('row').map(row => row.textContent);
    expect(rows).toEqual(
      expect.arrayContaining(
        [['manual', 'Active'], ...statuses].map(([title, label]) =>
          expect.stringMatching(new RegExp(`${title}.*${label}`))
        )
      )
    );
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

    expect(router.location.pathname).toBe('/organizations/org-slug/seer/investigations/');
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
      url: '/organizations/org-slug/notebooks/1/',
      body: {
        ...InvestigationFixture(),
        blocks: [],
        filters: {},
        parameters: [],
        projectIds: [],
        source: {type: 'manual', ref: {}, revision: null},
        titleGeneration: {status: null},
      },
    });

    renderView();
    await userEvent.click(
      await screen.findByRole('link', {name: 'Database latency investigation'})
    );

    await waitFor(() => expect(detailRequest).toHaveBeenCalledTimes(1));
  });

  describe('refreshes running title and summary generation in the list with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
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

      await act(() => jest.advanceTimersByTimeAsync(2000));
      expect(screen.getByText('Checkout errors across releases')).toBeInTheDocument();
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
  });

  it('toggles an investigation favorite and refreshes the list', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    const favoriteRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/notebooks/1/favorite/',
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
        '/organizations/org-slug/notebooks/1/favorite/',
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
        '/organizations/org-slug/notebooks/1/favorite/',
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
      url: '/organizations/org-slug/notebooks/1/favorite/',
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
      url: '/organizations/org-slug/notebooks/1/duplicate/',
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
        `${window.location.origin}/organizations/org-slug/seer/investigations/1/`
      )
    );
    expect(toast.success).toHaveBeenCalledWith('Investigation link copied.');
  });

  it('deletes only after confirmation and sends the current version', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/notebooks/1/',
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
        '/organizations/org-slug/notebooks/1/',
        expect.objectContaining({data: {notebookVersion: 3}})
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
      url: '/organizations/org-slug/notebooks/1/',
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
      url: '/organizations/org-slug/notebooks/1/',
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

  it('reports a favorite failure', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/notebooks/1/favorite/',
      method: 'PUT',
      statusCode: 500,
    });

    renderView();
    await userEvent.click(
      await screen.findByRole('button', {name: 'Favorite Database latency investigation'})
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Unable to update investigation favorite.')
    );
  });

  it('reports a duplicate failure', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/notebooks/1/duplicate/',
      method: 'POST',
      statusCode: 500,
    });

    renderView();
    await userEvent.click(
      await screen.findByLabelText('More options for Database latency investigation')
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Duplicate'}));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Unable to duplicate investigation.')
    );
  });

  it('reports a delete failure', async () => {
    MockApiClient.addMockResponse({
      url: listUrl,
      body: [InvestigationFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/notebooks/1/',
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
      expect(toast.error).toHaveBeenCalledWith('Unable to delete investigation.')
    );
  });
});
