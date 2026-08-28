import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import OrganizationServiceAccounts from 'sentry/views/settings/organizationServiceAccounts';
import type {ServiceAccount} from 'sentry/views/settings/organizationServiceAccounts/api';

describe('OrganizationServiceAccounts', () => {
  const accountsEndpoint = '/organizations/org-slug/service-accounts/';
  const teamsEndpoint = '/organizations/org-slug/teams/';
  const account: ServiceAccount = {
    id: '42',
    name: 'Deploy bot',
    role: 'member',
    teams: ['team-slug'],
    isActive: true,
    dateCreated: '2026-01-01T00:00:00Z',
    dateUpdated: '2026-01-01T00:00:00Z',
    tokens: [
      {
        id: '91',
        name: 'Production deploys',
        scopes: ['event:read', 'project:read'],
        tokenLastCharacters: 'abcd',
        expiresAt: null,
      },
    ],
  };

  function renderPage(accounts: ServiceAccount[] = [account]) {
    MockApiClient.addMockResponse({
      url: accountsEndpoint,
      method: 'GET',
      body: accounts,
    });
    MockApiClient.addMockResponse({
      url: teamsEndpoint,
      method: 'GET',
      body: [TeamFixture({slug: 'team-slug'})],
    });

    const organization = OrganizationFixture({
      features: ['service-accounts'],
      access: ['org:admin'],
      defaultRole: '',
      orgRoleList: OrganizationFixture().orgRoleList.map(role => ({
        ...role,
        isAllowed: false,
      })),
    });
    render(<OrganizationServiceAccounts />, {organization});
    renderGlobalModal({organization});
  }

  it('renders accounts, membership, and token permissions', async () => {
    renderPage();

    expect(await screen.findByRole('heading', {name: 'Deploy bot'})).toBeInTheDocument();
    expect(screen.getByText(/#team-slug/)).toBeInTheDocument();
    expect(screen.getByText('Production deploys')).toBeInTheDocument();
    expect(screen.getByText(/Ending in abcd/)).toBeInTheDocument();
    expect(screen.getByText(/event:read, project:read/)).toBeInTheDocument();
  });

  it('creates an account and displays its secret once', async () => {
    renderPage([]);
    const postMock = MockApiClient.addMockResponse({
      url: accountsEndpoint,
      method: 'POST',
      body: {...account, token: 'sntrys_service_account_secret'},
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Create Service Account'})
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Deploy bot');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create Service Account',
      })
    );

    expect(await screen.findByLabelText('New service account token')).toHaveValue(
      'sntrys_service_account_secret'
    );
    expect(postMock).toHaveBeenCalledWith(
      accountsEndpoint,
      expect.objectContaining({
        data: {
          name: 'Deploy bot',
          role: 'member',
          scopes: ['event:read', 'org:read', 'project:read'],
          teams: [],
          tokenName: 'Default token',
        },
      })
    );
  });

  it('disables and deletes an account', async () => {
    renderPage();
    const updateMock = MockApiClient.addMockResponse({
      url: `${accountsEndpoint}42/`,
      method: 'PUT',
      body: {...account, isActive: false},
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: `${accountsEndpoint}42/`,
      method: 'DELETE',
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Disable'}));
    expect(updateMock).toHaveBeenCalledWith(
      `${accountsEndpoint}42/`,
      expect.objectContaining({data: {isActive: false}})
    );

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await userEvent.click(screen.getByTestId('confirm-button'));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
  });

  it('creates and revokes account tokens', async () => {
    renderPage();
    const createTokenMock = MockApiClient.addMockResponse({
      url: `${accountsEndpoint}42/tokens/`,
      method: 'POST',
      body: {
        ...account.tokens[0],
        id: '92',
        name: 'Staging deploys',
        token: 'sntrys_second_secret',
      },
    });
    const revokeMock = MockApiClient.addMockResponse({
      url: `${accountsEndpoint}42/tokens/91/`,
      method: 'DELETE',
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Create Token'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Staging deploys');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Create Token'})
    );

    expect(await screen.findByLabelText('New service account token')).toHaveValue(
      'sntrys_second_secret'
    );
    expect(createTokenMock).toHaveBeenCalledWith(
      `${accountsEndpoint}42/tokens/`,
      expect.objectContaining({
        data: {
          name: 'Staging deploys',
          scopes: ['event:read', 'org:read', 'project:read'],
        },
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Revoke'}));
    await userEvent.click(screen.getByTestId('confirm-button'));
    await waitFor(() => expect(revokeMock).toHaveBeenCalledTimes(1));
  });
});

describe('service account settings navigation', () => {
  const serviceAccountsSection = getUserOrgNavigationConfiguration().find(section =>
    section.items.some(item => item.id === 'service-accounts')
  );
  const serviceAccountsItem = serviceAccountsSection?.items.find(
    item => item.id === 'service-accounts'
  );

  it('requires the feature and organization admin access', () => {
    if (!serviceAccountsSection || !serviceAccountsItem) {
      throw new Error('Expected service account navigation to be configured');
    }
    const show = serviceAccountsItem?.show;
    if (typeof show !== 'function') {
      throw new Error('Expected service account navigation to have a show predicate');
    }
    expect(
      show({
        ...serviceAccountsSection,
        organization: OrganizationFixture({
          features: ['service-accounts'],
          access: ['org:admin'],
        }),
        isSelfHosted: false,
      })
    ).toBe(true);
    expect(
      show({
        ...serviceAccountsSection,
        organization: OrganizationFixture({features: [], access: ['org:admin']}),
        isSelfHosted: false,
      })
    ).toBe(false);
    expect(
      show({
        ...serviceAccountsSection,
        organization: OrganizationFixture({
          features: ['service-accounts'],
          access: ['org:read'],
        }),
        isSelfHosted: false,
      })
    ).toBe(false);
  });
});
