import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {investigationDetailQueryOptions} from 'sentry/views/investigations/api';
import InvestigationDetailView from 'sentry/views/investigations/detail';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const detailUrl = '/organizations/org-slug/investigations/investigation-1/';

function InvestigationDetailFixture(overrides: Partial<InvestigationDetail> = {}) {
  return {
    id: 'investigation-1',
    title: 'Investigate database latency',
    status: 'active',
    sourceType: 'manual',
    createdBy: '1',
    dateCreated: '2026-08-13T20:00:00Z',
    dateUpdated: '2026-08-13T21:00:00Z',
    version: 1,
    blockCount: 2,
    isFavorited: false,
    blocks: [
      {
        id: 'block-1',
        position: 0,
        kind: 'text',
        title: 'Summary',
        content: 'Initial notes',
        generationPrompt: '',
        generatedContent: '',
        output: null,
        outputStatus: 'notRun',
        currentExecution: null,
        config: {},
        display: {type: 'markdown'},
        dependencies: [],
        parameterKeys: [],
        version: 1,
        staleAt: null,
        createdBy: '1',
        lastEditedBy: '1',
      },
      {
        id: 'block-2',
        position: 1,
        kind: 'query',
        title: 'Latency query',
        content: '',
        generationPrompt: 'Find slow spans',
        generatedContent: '',
        output: null,
        outputStatus: 'notRun',
        currentExecution: null,
        config: {},
        display: {type: 'table'},
        dependencies: [],
        parameterKeys: [],
        version: 1,
        staleAt: null,
        createdBy: '1',
        lastEditedBy: '1',
      },
    ],
    filters: {},
    parameters: [],
    projectIds: [],
    source: {type: 'manual', ref: {}, revision: null},
    template: null,
    titleGeneration: {status: null},
    ...overrides,
  };
}

function renderView(
  renderOrganization = organization,
  queryClient = makeTestQueryClient()
) {
  const result = render(<InvestigationDetailView />, {
    additionalWrapper: ({children}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    organization: renderOrganization,
    initialRouterConfig: {
      location: {
        pathname: '/organizations/org-slug/seer/investigation/investigation-1/',
      },
      route: '/organizations/:orgId/seer/investigation/:investigationId/',
    },
  });

  return {...result, queryClient};
}

describe('Investigation detail', () => {
  it('loads and renders the complete investigation response', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText('Investigate database latency')).toBeInTheDocument();
    expect(screen.getByText(/"id": "investigation-1"/)).toBeInTheDocument();
    expect(screen.getByText(/"blocks":/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reuses an investigation prefetched before the detail page mounts', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    const queryClient = makeTestQueryClient();

    await queryClient.prefetchQuery(
      investigationDetailQueryOptions('org-slug', 'investigation-1')
    );
    renderView(organization, queryClient);

    expect(screen.getByText('Investigate database latency')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('renders the initial load error', async () => {
    MockApiClient.addMockResponse({url: detailUrl, statusCode: 500});

    renderView();

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('retains cached data when a background refetch fails', async () => {
    const queryClient = makeTestQueryClient();
    const options = investigationDetailQueryOptions('org-slug', 'investigation-1');
    queryClient.setQueryData(options.queryKey, {
      headers: {},
      json: InvestigationDetailFixture(),
    });
    const request = MockApiClient.addMockResponse({url: detailUrl, statusCode: 500});

    renderView(organization, queryClient);
    expect(screen.getByText('Investigate database latency')).toBeInTheDocument();

    await act(() => queryClient.invalidateQueries({queryKey: options.queryKey}));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Investigate database latency')).toBeInTheDocument();
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
  });

  it('does not bootstrap when the feature is disabled', () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView(OrganizationFixture({features: [], openMembership: true}));

    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('does not bootstrap for a closed-membership organization', () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView(
      OrganizationFixture({features: ['investigations'], openMembership: false})
    );

    expect(
      screen.getByText(
        'Investigations are only available to organizations with open membership.'
      )
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
