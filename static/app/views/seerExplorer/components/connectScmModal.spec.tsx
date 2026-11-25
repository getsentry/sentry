import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  cleanup,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import * as pipelineModal from 'sentry/components/pipeline/modal';

import {openConnectScmModal, useConnectScmModalFromUrl} from './connectScmModal';

const organization = OrganizationFixture();
const withPrompt = OrganizationFixture({features: ['ask-seer-scm-connect-prompt']});
const integration = GitHubIntegrationFixture();

function mockRepoSync(status: string | null) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/integrations/${integration.id}/repo-sync/`,
    body: {status, trigger: status ? 'install' : null, reason: null},
  });
}

function mockRepoAccess(status: string) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/seer/repo-access/`,
    body: {status, connectedAccounts: []},
    match: [MockApiClient.matchQuery({repoName: 'acme/app'})],
  });
}

describe('ConnectScmModal after the install', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [GitHubIntegrationProviderFixture()]},
    });
    mockRepoSync(null);
    jest
      .spyOn(pipelineModal, 'PipelineModal')
      .mockImplementation(({onComplete, closeModal: finish}) => (
        <Button
          onClick={() => {
            onComplete?.(integration as never);
            finish();
          }}
        >
          Finish install
        </Button>
      ));
  });

  function openModalForRepo() {
    const onInstall = jest.fn();
    renderGlobalModal({organization});
    act(() => openConnectScmModal({repoName: 'acme/app', onInstall}));
    return {onInstall};
  }

  async function finishInstall() {
    await userEvent.click(await screen.findByRole('button', {name: 'Add GitHub'}));
    await userEvent.click(screen.getByRole('button', {name: 'Finish install'}));
  }

  it("closes once the install finishes when there's no repo sync to wait for", async () => {
    const {onInstall} = openModalForRepo();

    await finishInstall();

    expect(onInstall).toHaveBeenCalledWith(integration);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  describe('while the repos sync', () => {
    beforeEach(() => {
      jest.useFakeTimers({advanceTimers: true});
    });

    afterEach(() => {
      try {
        cleanup();
        jest.runOnlyPendingTimers();
      } finally {
        jest.useRealTimers();
      }
    });

    it('waits for the repos, then closes once Seer can access the repo', async () => {
      mockRepoSync('syncing');
      const {onInstall} = openModalForRepo();

      await finishInstall();

      expect(
        await screen.findByText(/Getting your repos from GitHub/)
      ).toBeInTheDocument();
      expect(onInstall).toHaveBeenCalledWith(integration);

      mockRepoSync('done');
      mockRepoAccess('found');

      await act(() => jest.advanceTimersByTimeAsync(2_000));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });

  it("says when the repo isn't in the account's repos, and checks again", async () => {
    mockRepoSync('done');
    const access = mockRepoAccess('repo_not_in_sentry');
    openModalForRepo();

    await finishInstall();

    expect(
      await screen.findByText(/isn't in the repos Sentry got from/)
    ).toBeInTheDocument();

    access.mockClear();
    await userEvent.click(screen.getByRole('button', {name: 'Check again'}));

    await waitFor(() => expect(access).toHaveBeenCalled());
  });

  it("says when it couldn't get the repos", async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repo-sync/`,
      statusCode: 500,
      body: {},
    });
    openModalForRepo();

    await finishInstall();

    expect(
      await screen.findByText(/Couldn't get your repos from GitHub/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });
});

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
