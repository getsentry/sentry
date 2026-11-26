import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {useConnectScmModalFromUrl} from './connectScmModal';

const organization = OrganizationFixture();
const withPrompt = OrganizationFixture({features: ['ask-seer-scm-connect-prompt']});

describe('useConnectScmModalFromUrl', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [GitHubIntegrationProviderFixture()]},
    });
  });

  function ConnectScmModalFromUrl() {
    useConnectScmModalFromUrl();
    return null;
  }

  function renderFromUrl(
    query: Record<string, string>,
    org: ReturnType<typeof OrganizationFixture> = withPrompt
  ) {
    renderGlobalModal({organization: org});
    return render(<ConnectScmModalFromUrl />, {
      organization: org,
      initialRouterConfig: {
        location: {pathname: `/settings/${org.slug}/integrations/`, query},
      },
    });
  }

  it('opens for the repo the URL names, then takes the repo out of the URL', async () => {
    const {router} = renderFromUrl({
      category: 'source code management',
      connectScmRepo: 'acme-labs/app',
    });

    expect(await screen.findByRole('button', {name: 'Add GitHub'})).toBeInTheDocument();
    expect(screen.getByText('acme-labs/app')).toBeInTheDocument();
    await waitFor(() =>
      expect(router.location.query).toEqual({category: 'source code management'})
    );
  });

  it("doesn't open for a member, who can't install integrations", async () => {
    const member = OrganizationFixture({
      access: ['org:read'],
      features: ['ask-seer-scm-connect-prompt'],
    });
    const {router} = renderFromUrl({connectScmRepo: 'acme-labs/app'}, member);

    await waitFor(() => expect(router.location.query).toEqual({}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("doesn't open without the Seer chat's source control prompt", async () => {
    const {router} = renderFromUrl({connectScmRepo: 'acme-labs/app'}, organization);

    await waitFor(() => expect(router.location.query).toEqual({}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
