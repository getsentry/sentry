import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ServiceAccountTokens} from './serviceAccountTokens';
import type {ServiceAccount, ServiceAccountToken} from './types';

describe('ServiceAccountTokens', () => {
  const organization = OrganizationFixture({
    features: ['service-accounts'],
    access: [...OrganizationFixture().access, 'service_account:write'],
  });
  const tokensUrl = `/organizations/${organization.slug}/service-accounts/10/tokens/`;
  const account: ServiceAccount = {
    id: '10',
    name: 'github-actions-deploy',
    // The fixture org's access doesn't include `event:read`.
    scopes: ['event:read', 'org:read', 'project:read', 'project:write'],
    projectIds: ['1'],
    allProjects: false,
    ownerKind: 'organization',
    dateCreated: '2026-11-01T00:00:00Z',
  };
  const token: ServiceAccountToken = {
    id: '5',
    name: 'GitHub Actions: prod',
    scopes: ['project:read'],
    tokenLastCharacters: 'a1b2',
    dateCreated: '2026-11-02T00:00:00Z',
    dateLastUsed: null,
    dateExpires: null,
  };

  function renderTokens(serviceAccount = account) {
    const queryClient = makeTestQueryClient();
    render(<ServiceAccountTokens account={serviceAccount} />, {
      organization,
      additionalWrapper: ({children}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    renderGlobalModal({
      organization,
      additionalWrapper: ({children}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    return queryClient;
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('lists tokens without their values', async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: [token]});

    renderTokens();

    expect(await screen.findByText('GitHub Actions: prod')).toBeInTheDocument();
    expect(screen.getByText('sntrym_************a1b2')).toBeInTheDocument();
    expect(screen.getByText('1 scope')).toBeInTheDocument();
    expect(screen.getAllByText('Never')).toHaveLength(2);
  });

  it('shows the scope count when the account has fewer scopes than the token', async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: [token]});

    renderTokens({...account, scopes: []});

    expect(await screen.findByText('1 scope')).toBeInTheDocument();
  });

  it('shows same as account for matching scopes in a different order', async () => {
    MockApiClient.addMockResponse({
      url: tokensUrl,
      body: [{...token, scopes: account.scopes.toReversed()}],
    });

    renderTokens();

    expect(await screen.findByText('Same as account')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: []});

    renderTokens();

    expect(await screen.findByText('No tokens yet')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create Token'})).toBeEnabled();
  });

  it('creates a token and shows its value once', async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: []});
    const createRequest = MockApiClient.addMockResponse({
      url: tokensUrl,
      method: 'POST',
      statusCode: 201,
      body: {...token, token: 'sntrym_secret-value'},
    });

    const queryClient = renderTokens();

    await userEvent.click(await screen.findByRole('button', {name: 'Create Token'}));
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Name'}),
      'GitHub Actions: prod'
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Create Token'})
    );

    expect(await screen.findByDisplayValue('sntrym_secret-value')).toBeInTheDocument();
    expect(
      screen.getByText('Copy this token now. You won’t be able to see it again.')
    ).toBeInTheDocument();

    const {data} = createRequest.mock.calls[0][1];
    expect(data.name).toBe('GitHub Actions: prod');
    expect(data.scopes).toEqual(['org:read', 'project:read', 'project:write']);
    const days = (Date.parse(data.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(30);

    await userEvent.click(screen.getByRole('button', {name: 'Done'}));
    await waitFor(() =>
      expect(screen.queryByDisplayValue('sntrym_secret-value')).not.toBeInTheDocument()
    );
    const mutations = queryClient.getMutationCache().getAll();
    expect(mutations).toHaveLength(1);
    expect(mutations[0]!.state.status).toBe('success');
    expect(mutations[0]!.state.data).toBeUndefined();
  });

  it('creates a token with chosen scopes and no expiration', async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: []});
    const createRequest = MockApiClient.addMockResponse({
      url: tokensUrl,
      method: 'POST',
      statusCode: 201,
      body: {...token, token: 'sntrym_secret-value'},
    });

    renderTokens();

    await userEvent.click(await screen.findByRole('button', {name: 'Create Token'}));
    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'Scripts');
    await userEvent.click(screen.getByRole('radio', {name: 'Choose scopes'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'project:write'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'org:read'}));
    expect(screen.queryByRole('checkbox', {name: 'event:read'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('textbox', {name: 'Expiration'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'No expiration'}));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Create Token'})
    );

    await screen.findByDisplayValue('sntrym_secret-value');
    expect(createRequest).toHaveBeenCalledWith(
      tokensUrl,
      expect.objectContaining({
        data: {name: 'Scripts', scopes: ['project:read'], expiresAt: null},
      })
    );
  });

  it('shows errors from the API', async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: []});
    MockApiClient.addMockResponse({
      url: tokensUrl,
      method: 'POST',
      statusCode: 400,
      body: {detail: {scopes: ["You can't grant scopes you don't have: org:read"]}},
    });

    renderTokens();

    await userEvent.click(await screen.findByRole('button', {name: 'Create Token'}));
    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'Scripts');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Create Token'})
    );

    expect(
      await screen.findByText("You can't grant scopes you don't have: org:read")
    ).toBeInTheDocument();
    expect(screen.queryByText('Token created')).not.toBeInTheDocument();
  });

  it('revokes a token after confirming', async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: [token]});
    const revokeRequest = MockApiClient.addMockResponse({
      url: `${tokensUrl}5/`,
      method: 'DELETE',
    });

    renderTokens();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Revoke GitHub Actions: prod'})
    );
    expect(
      await screen.findByText(/Revocation may take a short time to take effect/)
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Revoke Token'}));

    await waitFor(() => expect(revokeRequest).toHaveBeenCalled());
  });

  it('removes a revoked token on a later cursor page', async () => {
    MockApiClient.addMockResponse({
      url: tokensUrl,
      body: [{...token, id: '4', name: 'First page token'}],
      headers: {
        Link: `<${tokensUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });
    MockApiClient.addMockResponse({
      url: tokensUrl,
      match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
      body: [token],
    });
    MockApiClient.addMockResponse({url: `${tokensUrl}5/`, method: 'DELETE'});

    renderTokens();

    await screen.findByText('First page token');
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Revoke GitHub Actions: prod'})
    );
    MockApiClient.addMockResponse({
      url: tokensUrl,
      match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
      body: [],
    });
    await userEvent.click(await screen.findByRole('button', {name: 'Revoke Token'}));

    expect(await screen.findByText('No tokens yet')).toBeInTheDocument();
    expect(screen.queryByText('GitHub Actions: prod')).not.toBeInTheDocument();
  });

  it("can't manage tokens of an account owned by a Seer automation", async () => {
    MockApiClient.addMockResponse({url: tokensUrl, body: [token]});

    renderTokens({...account, ownerKind: 'seer_workflow_config'});

    expect(
      await screen.findByRole('button', {name: 'Revoke GitHub Actions: prod'})
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', {name: 'Create Token'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
