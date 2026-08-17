import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {investigationDetailQueryOptions} from 'sentry/views/investigations/api';
import InvestigationDetailView from 'sentry/views/investigations/detail';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

jest.unmock('@tanstack/react-pacer');

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
  beforeEach(() => {
    jest.spyOn(indicators, 'addSuccessMessage').mockImplementation();
    jest.spyOn(indicators, 'addErrorMessage').mockImplementation();
  });

  it('loads and renders the complete investigation response', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText('Investigate database latency')).toBeInTheDocument();
    const debugPanel = screen.getByRole('button', {name: 'Investigation JSON'});
    expect(screen.getByText(/"id": "investigation-1"/)).not.toBeVisible();

    await userEvent.click(debugPanel);

    expect(screen.getByText(/"id": "investigation-1"/)).toBeVisible();
    expect(screen.getByText(/"blocks":/)).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('renders block output instead of block content', async () => {
    const investigation = InvestigationDetailFixture();
    const firstBlock = investigation.blocks[0];
    if (!firstBlock) {
      throw new Error('Expected an investigation block fixture.');
    }
    investigation.blocks[0] = {
      ...firstBlock,
      content: 'Prompt-side content that should not render',
      generatedContent: 'Generated content that should not render',
      output: {schemaVersion: 1, markdown: 'Actual persisted block output'},
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    expect(await screen.findByText('Actual persisted block output')).toBeInTheDocument();
    expect(
      screen.queryByText('Prompt-side content that should not render')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Generated content that should not render')
    ).not.toBeInTheDocument();
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

  it('optimistically renames and debounces persistence', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    const renameRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: InvestigationDetailFixture({
        title: 'Regional latency investigation',
        version: 2,
      }),
    });

    renderView();
    const titleInput = await screen.findByLabelText('Investigation title');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Regional latency investigation');

    expect(titleInput).toHaveValue('Regional latency investigation');
    expect(renameRequest).not.toHaveBeenCalled();

    await waitFor(
      () =>
        expect(renameRequest).toHaveBeenCalledWith(
          detailUrl,
          expect.objectContaining({
            data: {
              title: 'Regional latency investigation',
              investigationVersion: 1,
            },
          })
        ),
      {timeout: 1500}
    );
  });

  it('duplicates and opens the duplicate from the title menu', async () => {
    MockApiClient.addMockResponse({url: detailUrl, body: InvestigationDetailFixture()});
    MockApiClient.addMockResponse({
      url: `${detailUrl}duplicate/`,
      method: 'POST',
      body: InvestigationDetailFixture({id: 'investigation-2'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/investigation-2/',
      body: InvestigationDetailFixture({id: 'investigation-2'}),
    });

    const {router} = renderView();
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Duplicate'}));

    await waitFor(() =>
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/seer/investigation/investigation-2/'
      )
    );
  });

  it('copies the link from the title menu', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {writeText},
      writable: true,
    });
    MockApiClient.addMockResponse({url: detailUrl, body: InvestigationDetailFixture()});

    renderView();
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Copy link'}));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/organizations/org-slug/seer/investigation/investigation-1/`
      )
    );
  });

  it('deletes after confirmation and returns to the list', async () => {
    MockApiClient.addMockResponse({url: detailUrl, body: InvestigationDetailFixture()});
    const deleteRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'DELETE',
    });

    const {router} = renderView();
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    expect(deleteRequest).not.toHaveBeenCalled();
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(deleteRequest).toHaveBeenCalledWith(
        detailUrl,
        expect.objectContaining({data: {investigationVersion: 1}})
      )
    );
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/investigations/'
    );
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
