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

function mockRepoAccess(status: string) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/seer/repo-access/`,
    body: {status, connectedAccounts: []},
    match: [MockApiClient.matchQuery({repoName: 'acme/app'})],
  });
}

/** Makes the install a button that finishes it with `integration`. */
function mockInstallPipeline() {
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
}

async function finishInstall() {
  await userEvent.click(await screen.findByRole('button', {name: 'Add GitHub'}));
  await userEvent.click(screen.getByRole('button', {name: 'Finish install'}));
}

describe('ConnectScmModal after the install', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [GitHubIntegrationProviderFixture()]},
    });
    mockInstallPipeline();
  });

  function openModalForRepo() {
    const onInstall = jest.fn();
    renderGlobalModal({organization});
    act(() => openConnectScmModal({repoName: 'acme/app', onInstall}));
    return {onInstall};
  }

  it('closes after the install when the repo is already available', async () => {
    mockRepoAccess('found');
    const {onInstall} = openModalForRepo();

    await finishInstall();

    expect(onInstall).toHaveBeenCalledTimes(1);
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
      mockRepoAccess('repos_syncing');
      const {onInstall} = openModalForRepo();

      await finishInstall();

      expect(
        await screen.findByText(/Getting your repos from GitHub/)
      ).toBeInTheDocument();
      expect(onInstall).toHaveBeenCalledTimes(1);

      mockRepoAccess('found');

      await act(() => jest.advanceTimersByTimeAsync(5_000));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });

  it('with no repo, closes once Seer can re-list the repos', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/repo-access/`,
      body: {status: 'found', connectedAccounts: []},
    });
    renderGlobalModal({organization});
    act(() => openConnectScmModal({repoName: null, onInstall: jest.fn()}));

    expect(
      await screen.findByText(
        "Seer can't see this organization's repos. Connect the source control account they're on."
      )
    ).toBeInTheDocument();

    await finishInstall();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("says when the repo isn't in Sentry, and checks again", async () => {
    const access = mockRepoAccess('repo_not_in_sentry');
    openModalForRepo();

    await finishInstall();

    expect(await screen.findByText(/isn't in Sentry/)).toBeInTheDocument();

    access.mockClear();
    await userEvent.click(screen.getByRole('button', {name: 'Check again'}));

    await waitFor(() => expect(access).toHaveBeenCalled());
  });

  it("says when it couldn't get the repos", async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/repo-access/`,
      body: {
        status: 'repo_not_in_sentry',
        connectedAccounts: [],
        syncFailure: 'rate_limited',
      },
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

  it('opens with no repo when the URL names none', async () => {
    renderFromUrl({connectScmRepo: ''});

    expect(await screen.findByRole('button', {name: 'Add GitHub'})).toBeInTheDocument();
    expect(
      screen.getByText(
        "Seer can't see this organization's repos. Connect the source control account they're on."
      )
    ).toBeInTheDocument();
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
