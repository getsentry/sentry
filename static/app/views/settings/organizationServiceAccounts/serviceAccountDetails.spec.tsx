import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import OrganizationServiceAccountDetails from './serviceAccountDetails';

describe('OrganizationServiceAccountDetails', () => {
  const ACCOUNT_ENDPOINT = '/organizations/org-slug/service-accounts/1/';
  const TOKENS_ENDPOINT = '/organizations/org-slug/service-accounts/1/tokens/';

  const writeOrganization = OrganizationFixture({
    access: ['org:read', 'service_account:read', 'service_account:write'],
  });

  const initialRouterConfig = {
    location: {pathname: '/settings/org-slug/service-accounts/1/'},
    route: '/settings/:orgId/service-accounts/:serviceAccountId/',
  };

  const token = {
    id: '10',
    name: 'ci-deploy',
    scopes: ['project:read', 'project:releases'],
    tokenLastCharacters: 'abcd',
    dateCreated: '2026-11-02T00:00:00Z',
    dateLastUsed: null,
    dateExpires: null,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() =>
      ProjectsStore.loadInitialData([ProjectFixture({id: '2', slug: 'backend'})])
    );
    MockApiClient.addMockResponse({
      url: ACCOUNT_ENDPOINT,
      body: {
        id: '1',
        name: 'github-actions-deploy',
        scopes: ['project:read', 'project:releases'],
        projectIds: ['2'],
        allProjects: false,
        dateCreated: '2026-11-01T00:00:00Z',
      },
    });
  });

  it('shows the service account and its tokens', async () => {
    MockApiClient.addMockResponse({url: TOKENS_ENDPOINT, body: [token]});

    render(<OrganizationServiceAccountDetails />, {initialRouterConfig});

    expect(await screen.findByText('ci-deploy')).toBeInTheDocument();
    expect(screen.getByText('github-actions-deploy')).toBeInTheDocument();
    expect(screen.getByText('project:read, project:releases')).toBeInTheDocument();
    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.getByText('sntrym_************abcd')).toBeInTheDocument();
    expect(screen.getByText('2 scopes')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    MockApiClient.addMockResponse({url: TOKENS_ENDPOINT, body: []});

    render(<OrganizationServiceAccountDetails />, {initialRouterConfig});

    expect(await screen.findByText(/No tokens yet/)).toBeInTheDocument();
  });

  it('shows an error when tokens fail to load', async () => {
    MockApiClient.addMockResponse({url: TOKENS_ENDPOINT, statusCode: 500, body: {}});

    render(<OrganizationServiceAccountDetails />, {initialRouterConfig});

    expect(await screen.findByText('Failed to load tokens.')).toBeInTheDocument();
  });

  it('revokes a token after confirmation', async () => {
    MockApiClient.addMockResponse({url: TOKENS_ENDPOINT, body: [token]});
    const deleteMock = MockApiClient.addMockResponse({
      url: `${TOKENS_ENDPOINT}10/`,
      method: 'DELETE',
      statusCode: 204,
    });

    render(<OrganizationServiceAccountDetails />, {
      initialRouterConfig,
      organization: writeOrganization,
    });
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Revoke ci-deploy'}));
    expect(
      await screen.findByText(/Revoke sntrym_\*{12}abcd\? Anything using it/)
    ).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();

    MockApiClient.addMockResponse({url: TOKENS_ENDPOINT, body: []});
    await userEvent.click(screen.getByRole('button', {name: 'Revoke'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
    expect(await screen.findByText(/No tokens yet/)).toBeInTheDocument();
  });

  it('disables create and revoke without service_account:write', async () => {
    MockApiClient.addMockResponse({url: TOKENS_ENDPOINT, body: [token]});

    render(<OrganizationServiceAccountDetails />, {
      initialRouterConfig,
      organization: OrganizationFixture({access: ['org:read', 'service_account:read']}),
    });

    expect(await screen.findByRole('button', {name: 'Revoke ci-deploy'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'New Token'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('links New Token to the create page', async () => {
    MockApiClient.addMockResponse({url: TOKENS_ENDPOINT, body: []});

    render(<OrganizationServiceAccountDetails />, {
      initialRouterConfig,
      organization: writeOrganization,
    });

    expect(await screen.findByRole('button', {name: 'New Token'})).toHaveAttribute(
      'href',
      '/settings/org-slug/service-accounts/1/tokens/new/'
    );
  });
});
