import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {toast} from '@sentry/scraps/toast';

import OrganizationServiceAccountNewToken from './newServiceAccountToken';

describe('OrganizationServiceAccountNewToken', () => {
  const ACCOUNT_ENDPOINT = '/organizations/org-slug/service-accounts/1/';
  const TOKENS_ENDPOINT = '/organizations/org-slug/service-accounts/1/tokens/';

  const initialRouterConfig = {
    location: {pathname: '/settings/org-slug/service-accounts/1/tokens/new/'},
    route: '/settings/:orgId/service-accounts/:serviceAccountId/tokens/new/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.spyOn(toast, 'error');
    MockApiClient.addMockResponse({
      url: ACCOUNT_ENDPOINT,
      body: {
        id: '1',
        name: 'github-actions-deploy',
        scopes: ['project:read', 'project:releases'],
        projectIds: [],
        allProjects: true,
        dateCreated: '2026-11-01T00:00:00Z',
      },
    });
  });

  it('creates a token and shows it once', async () => {
    const createMock = MockApiClient.addMockResponse({
      url: TOKENS_ENDPOINT,
      method: 'POST',
      statusCode: 201,
      body: {
        id: '10',
        name: 'ci-deploy',
        scopes: ['project:releases'],
        tokenLastCharacters: 'abcd',
        dateCreated: '2026-11-02T00:00:00Z',
        dateLastUsed: null,
        dateExpires: null,
        token: 'sntrym_secret-token-abcd',
      },
    });

    const {router} = render(<OrganizationServiceAccountNewToken />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'ci-deploy');
    await userEvent.click(screen.getByRole('textbox', {name: 'Permission scopes'}));
    expect(screen.getByRole('menuitemcheckbox', {name: 'project:read'})).toBeChecked();
    expect(
      screen.getByRole('menuitemcheckbox', {name: 'project:releases'})
    ).toBeChecked();
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'project:read'}));
    await userEvent.click(screen.getByRole('button', {name: 'Create Token'}));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        TOKENS_ENDPOINT,
        expect.objectContaining({
          data: {name: 'ci-deploy', scopes: ['project:releases']},
        })
      )
    );
    expect(await screen.findByLabelText('Generated token')).toHaveValue(
      'sntrym_secret-token-abcd'
    );
    expect(screen.getByText(/it won't be shown again/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: "I've saved it"}));
    await waitFor(() =>
      expect(router.location.pathname).toBe('/settings/org-slug/service-accounts/1/')
    );
  });

  it('requires at least one permission', async () => {
    const createMock = MockApiClient.addMockResponse({
      url: TOKENS_ENDPOINT,
      method: 'POST',
      body: {},
    });

    render(<OrganizationServiceAccountNewToken />, {initialRouterConfig});

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'ci-deploy');
    await userEvent.click(screen.getByRole('textbox', {name: 'Permission scopes'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'project:read'}));
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', {name: 'project:releases'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create Token'}));

    expect(await screen.findByText('Pick at least one permission')).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('shows field errors from the API', async () => {
    MockApiClient.addMockResponse({
      url: TOKENS_ENDPOINT,
      method: 'POST',
      statusCode: 400,
      body: {
        detail: {
          name: ['A token with this name already exists.'],
          scopes: ['Scopes must be a subset of the service account scopes.'],
        },
      },
    });

    render(<OrganizationServiceAccountNewToken />, {initialRouterConfig});
    renderGlobalModal();

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'ci-deploy');
    await userEvent.click(screen.getByRole('button', {name: 'Create Token'}));

    expect(
      await screen.findByText('A token with this name already exists.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Scopes must be a subset of the service account scopes.')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Generated token')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a string error detail as a toast', async () => {
    MockApiClient.addMockResponse({
      url: TOKENS_ENDPOINT,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'system.url-prefix is not set.'},
    });

    render(<OrganizationServiceAccountNewToken />, {initialRouterConfig});

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'ci-deploy');
    await userEvent.click(screen.getByRole('button', {name: 'Create Token'}));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('system.url-prefix is not set.')
    );
  });
});
