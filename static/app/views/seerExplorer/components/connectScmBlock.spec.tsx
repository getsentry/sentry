import {Fragment, useState, type ComponentProps} from 'react';
import {focusManager, useQuery} from '@tanstack/react-query';
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
import {GlobalModal} from '@sentry/scraps/modal';
import {
  PictureInPictureProvider,
  usePictureInPicture,
} from '@sentry/scraps/pictureInPicture';

import * as pipelineModal from 'sentry/components/pipeline/modal';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

import {ConnectScmBlock} from './connectScmBlock';

type ConnectScmBlockResponse = ComponentProps<
  typeof ConnectScmBlock
>['respondToUserInput'];

const REPO_ACCESS_URL = '/organizations/org-slug/seer/repo-access/';
const REPOS_LINK = '/settings/org-slug/repos/';
const INTEGRATION_REQUEST_URL = '/organizations/org-slug/integration-requests/';
const retryOptions = {onError: expect.any(Function)};

describe('ConnectScmBlock', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  // Can't install integrations.
  const memberOrganization = OrganizationFixture({
    slug: 'org-slug',
    access: ['org:read', 'project:read', 'team:read'],
  });

  function mockRepoAccess(status: string, connectedAccounts: string[] = []) {
    return MockApiClient.addMockResponse({
      url: REPO_ACCESS_URL,
      body: {status, connectedAccounts},
      match: [MockApiClient.matchQuery({repoName: 'acme/app'})],
    });
  }

  function renderBlock({
    failureReason = 'no_scm_integration',
    org = organization,
  }: {failureReason?: string; org?: typeof organization} = {}) {
    const respondToUserInput = jest.fn();
    const pendingInput: PendingUserInput = {
      id: 'input-id',
      input_type: 'connect_scm',
      data: {repo_name: 'acme/app', failure_reason: failureReason},
    };
    render(
      <ConnectScmBlock
        pendingInput={pendingInput}
        respondToUserInput={respondToUserInput}
      />,
      {organization: org, additionalWrapper: PictureInPictureProvider}
    );
    return respondToUserInput;
  }

  it('shows that it is checking until the first answer', async () => {
    mockRepoAccess('repo_not_in_sentry');
    renderBlock({failureReason: 'repo_not_in_sentry'});

    expect(
      screen.getByText('Checking whether Seer can access acme/app')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Continue without code'})
    ).not.toBeInTheDocument();

    expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
    expect(
      screen.queryByText('Checking whether Seer can access acme/app')
    ).not.toBeInTheDocument();
  });

  describe('connecting source control', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/config/integrations/',
        body: {
          providers: [
            GitHubIntegrationProviderFixture(),
            GitHubIntegrationProviderFixture({
              key: 'bitbucket',
              slug: 'bitbucket',
              name: 'Bitbucket',
            }),
          ],
        },
      });
    });

    it('opens a modal to connect it when nothing is connected', async () => {
      mockRepoAccess('no_scm_integration');
      renderBlock();
      renderGlobalModal({organization});

      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
      expect(
        screen.getByText('No source control is connected to this organization.')
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Connect source control'}));

      const modal = await screen.findByRole('dialog');
      expect(modal).toHaveTextContent(
        'Seer needs access to acme/app. Connect the source control account it belongs to.'
      );
      expect(await screen.findByRole('button', {name: 'Add GitHub'})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Add Bitbucket'})
      ).not.toBeInTheDocument();
    });

    it('lists the connected accounts when the repo is under another one', async () => {
      mockRepoAccess('scm_account_not_connected', ['acme-labs', 'my-group']);
      renderBlock({failureReason: 'scm_account_not_connected'});

      expect(
        await screen.findByText(
          "This repo's account isn't connected to this organization. Connected: acme-labs, my-group."
        )
      ).toBeInTheDocument();
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

      it('continues the chat and closes the modal on the same answer', async () => {
        jest
          .spyOn(pipelineModal, 'PipelineModal')
          .mockImplementation(({onComplete, closeModal}) => (
            <Button
              onClick={() => {
                onComplete?.(GitHubIntegrationFixture() as never);
                closeModal();
              }}
            >
              Finish install
            </Button>
          ));
        mockRepoAccess('no_scm_integration');
        const listUrl = `/organizations/${organization.slug}/integrations/`;
        const listBeforeInstall = MockApiClient.addMockResponse({url: listUrl, body: []});
        const slack = MockApiClient.addMockResponse({
          url: listUrl,
          body: [],
          match: [MockApiClient.matchQuery({providerKey: 'slack'})],
        });
        function IntegrationLists() {
          const path = {organizationIdOrSlug: organization.slug};
          useQuery({
            ...apiOptions.as<OrganizationIntegration[]>()(
              '/organizations/$organizationIdOrSlug/integrations/',
              {path, staleTime: Infinity}
            ),
            retry: false,
          });
          useQuery(
            apiOptions.as<OrganizationIntegration[]>()(
              '/organizations/$organizationIdOrSlug/integrations/',
              {path, query: {providerKey: 'slack'}, staleTime: Infinity}
            )
          );
          return null;
        }
        const respondToUserInput = jest.fn();
        render(
          <Fragment>
            <IntegrationLists />
            <ConnectScmBlock
              pendingInput={{
                id: 'input-id',
                input_type: 'connect_scm',
                data: {repo_name: 'acme/app', failure_reason: 'no_scm_integration'},
              }}
              respondToUserInput={respondToUserInput}
            />
            <GlobalModal />
          </Fragment>,
          {organization, additionalWrapper: PictureInPictureProvider}
        );

        await userEvent.click(
          await screen.findByRole('button', {name: 'Connect source control'})
        );
        await userEvent.click(await screen.findByRole('button', {name: 'Add GitHub'}));
        expect(listBeforeInstall).toHaveBeenCalledTimes(1);
        expect(slack).toHaveBeenCalledTimes(1);
        const listAfterInstall = MockApiClient.addMockResponse({
          url: listUrl,
          statusCode: 500,
        });
        const scopedCheck = MockApiClient.addMockResponse({
          url: REPO_ACCESS_URL,
          body: {status: 'repos_syncing', connectedAccounts: []},
          match: [
            MockApiClient.matchQuery({
              repoName: 'acme/app',
              integrationId: GitHubIntegrationFixture().id,
            }),
          ],
        });
        await userEvent.click(screen.getByRole('button', {name: 'Finish install'}));

        expect(
          await screen.findByText(/Getting your repos from GitHub/)
        ).toBeInTheDocument();

        expect(screen.getByText('Sentry is importing repositories.')).toBeInTheDocument();
        expect(scopedCheck).toHaveBeenCalledTimes(1);
        expect(listAfterInstall).toHaveBeenCalledTimes(1);
        expect(slack).toHaveBeenCalledTimes(1);

        const readyCheck = mockRepoAccess('found');
        await act(() => jest.advanceTimersByTimeAsync(5_000));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(respondToUserInput).toHaveBeenCalledWith(
          'input-id',
          {decision: 'retry'},
          retryOptions
        );
        expect(respondToUserInput).toHaveBeenCalledTimes(1);
        expect(readyCheck).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('while the chat is popped out', () => {
    afterEach(() => {
      // @ts-expect-error - cleaning up the PiP stub
      delete window.documentPictureInPicture;
    });

    it('asks to move the chat back to the main window', async () => {
      const pipWindow = Object.assign(new EventTarget(), {
        document: document.implementation.createHTMLDocument('pip'),
        closed: false,
        focus: jest.fn(),
        close: jest.fn(),
      });
      Object.defineProperty(window, 'documentPictureInPicture', {
        configurable: true,
        writable: true,
        value: {window: null, requestWindow: jest.fn().mockResolvedValue(pipWindow)},
      });
      function Chat() {
        const {requestPipWindow} = usePictureInPicture();
        return (
          <Fragment>
            <Button onClick={() => requestPipWindow()}>Pop out</Button>
            <ConnectScmBlock
              pendingInput={{
                id: 'input-id',
                input_type: 'connect_scm',
                data: {repo_name: 'acme/app', failure_reason: 'no_scm_integration'},
              }}
              respondToUserInput={jest.fn()}
            />
          </Fragment>
        );
      }
      mockRepoAccess('no_scm_integration');
      render(<Chat />, {organization, additionalWrapper: PictureInPictureProvider});

      await userEvent.click(screen.getByRole('button', {name: 'Pop out'}));

      expect(
        await screen.findByText('To fix this, move the chat back into the main window.')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Connect source control'})
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Move chat back'}));
      expect(pipWindow.close).toHaveBeenCalled();
    });
  });

  it('links to repositories when the repo is not in Sentry', async () => {
    mockRepoAccess('repo_not_in_sentry');
    renderBlock({failureReason: 'repo_not_in_sentry'});

    expect(
      await screen.findByText(
        "This repo isn't in Sentry. Check its name, and that Sentry has access to it."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go to repositories'})).toHaveAttribute(
      'href',
      REPOS_LINK
    );
  });

  it('lets a member request source control instead of connecting it', async () => {
    mockRepoAccess('scm_account_not_connected', ['acme-labs']);
    const request = MockApiClient.addMockResponse({
      url: INTEGRATION_REQUEST_URL,
      method: 'POST',
      statusCode: 201,
    });
    renderBlock({failureReason: 'scm_account_not_connected', org: memberOrganization});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Request installation'})
    );

    expect(
      screen.queryByRole('button', {name: 'Connect source control'})
    ).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      INTEGRATION_REQUEST_URL,
      expect.objectContaining({
        data: {
          providerType: 'category',
          providerSlug: 'source code management',
          message:
            "Seer can't access acme/app. This repo's account isn't connected to this organization. Connected: acme-labs.",
          repoName: 'acme/app',
        },
      })
    );
    expect(
      await screen.findByRole('button', {name: 'Installation requested'})
    ).toBeDisabled();
  });

  it('stops offering to correct the repo name once a member has requested it', async () => {
    mockRepoAccess('no_scm_integration');
    MockApiClient.addMockResponse({
      url: INTEGRATION_REQUEST_URL,
      method: 'POST',
      statusCode: 201,
    });
    renderBlock({org: memberOrganization});
    expect(
      await screen.findByRole('button', {name: 'Correct repo name'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Request installation'}));

    expect(
      await screen.findByRole('button', {name: 'Installation requested'})
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Correct repo name'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Continue without code'})
    ).toBeInTheDocument();
  });

  it("keeps a member's request when the chat moves", async () => {
    function MovingChat() {
      const [place, setPlace] = useState('sidebar');
      return (
        <Fragment>
          <Button onClick={() => setPlace('popped out')}>Pop out</Button>
          <ConnectScmBlock
            key={place}
            pendingInput={{
              id: 'input-id',
              input_type: 'connect_scm',
              data: {repo_name: 'acme/app', failure_reason: 'no_scm_integration'},
            }}
            respondToUserInput={jest.fn()}
          />
        </Fragment>
      );
    }
    mockRepoAccess('no_scm_integration');
    const request = MockApiClient.addMockResponse({
      url: INTEGRATION_REQUEST_URL,
      method: 'POST',
      statusCode: 201,
    });
    render(<MovingChat />, {
      organization: memberOrganization,
      additionalWrapper: PictureInPictureProvider,
    });
    await userEvent.click(
      await screen.findByRole('button', {name: 'Request installation'})
    );
    expect(
      await screen.findByRole('button', {name: 'Installation requested'})
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Pop out'}));

    expect(
      await screen.findByRole('button', {name: 'Installation requested'})
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Correct repo name'})
    ).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('lets a member request source control when none is connected', async () => {
    mockRepoAccess('no_scm_integration');
    renderBlock({org: memberOrganization});

    expect(
      await screen.findByRole('button', {name: 'Request installation'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Request it from your Sentry organization owners, and you can continue here once they connect it.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Connect source control'})
    ).not.toBeInTheDocument();
  });

  it('links a member to repositories when the repo is not in Sentry', async () => {
    mockRepoAccess('repo_not_in_sentry');
    renderBlock({failureReason: 'repo_not_in_sentry', org: memberOrganization});

    expect(
      await screen.findByRole('button', {name: 'Go to repositories'})
    ).toHaveAttribute('href', REPOS_LINK);
    expect(
      screen.queryByRole('button', {name: 'Request installation'})
    ).not.toBeInTheDocument();
  });

  it('resumes the run and hides the popup when Seer can already access the repo', async () => {
    mockRepoAccess('found');
    const respondToUserInput = renderBlock();

    await waitFor(() =>
      expect(respondToUserInput).toHaveBeenCalledWith(
        'input-id',
        {decision: 'retry'},
        retryOptions
      )
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
    expect(respondToUserInput).toHaveBeenCalledTimes(1);
  });

  it('offers only Continue if auto-resume fails, including when the popup remounts', async () => {
    const respondToUserInput = jest.fn<void, Parameters<ConnectScmBlockResponse>>();
    function Chat() {
      const [showPopup, setShowPopup] = useState(true);
      return (
        <Fragment>
          <Button onClick={() => setShowPopup(!showPopup)}>Toggle popup</Button>
          {showPopup && (
            <ConnectScmBlock
              pendingInput={{
                id: 'input-id',
                input_type: 'connect_scm',
                data: {repo_name: 'acme/app', failure_reason: 'no_scm_integration'},
              }}
              respondToUserInput={respondToUserInput}
            />
          )}
        </Fragment>
      );
    }
    mockRepoAccess('found');
    render(<Chat />, {organization, additionalWrapper: PictureInPictureProvider});

    await waitFor(() => expect(respondToUserInput).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Toggle popup'}));
    act(() => respondToUserInput.mock.lastCall?.[2]?.onError?.());
    await userEvent.click(screen.getByRole('button', {name: 'Toggle popup'}));

    const continueButton = await screen.findByRole('button', {name: 'Continue'});
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(respondToUserInput).toHaveBeenCalledTimes(1);
    await userEvent.click(continueButton);
    expect(respondToUserInput).toHaveBeenNthCalledWith(
      2,
      'input-id',
      {decision: 'retry'},
      retryOptions
    );
    expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
  });

  it('does not resume automatically for an ambiguous repo name', async () => {
    mockRepoAccess('repo_ambiguous');
    const respondToUserInput = renderBlock();

    expect(
      await screen.findByText('More than one repository matches this name.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Correct repo name'})).toBeInTheDocument();
    expect(respondToUserInput).not.toHaveBeenCalled();
  });

  it('offers Continue when Sentry can not tell what is wrong', async () => {
    mockRepoAccess('unknown');
    renderBlock();

    expect(
      await screen.findByText(
        "Sentry can't tell what's wrong. Check the repo name, or continue and Seer will try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  describe('while the fix is on its way', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        focusManager.setFocused(undefined);
        cleanup();
        // The popup's own timers update its state.
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps checking while the tab is hidden', async () => {
      mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      // The user is fixing it in another tab, and the repo reaches Sentry.
      act(() => focusManager.setFocused(false));
      MockApiClient.clearMockResponses();
      mockRepoAccess('found');
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });

    it('checks again until Seer can access the repo, then resumes the run', async () => {
      mockRepoAccess('repo_not_in_sentry');
      const respondToUserInput = renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
      expect(respondToUserInput).not.toHaveBeenCalled();

      // The repo reaches Sentry.
      MockApiClient.clearMockResponses();
      const check = mockRepoAccess('found');
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
      expect(respondToUserInput).toHaveBeenCalledTimes(1);
      expect(respondToUserInput).toHaveBeenCalledWith(
        'input-id',
        {decision: 'retry'},
        retryOptions
      );
      await act(() => jest.advanceTimersByTimeAsync(30_000));
      expect(check).toHaveBeenCalledTimes(1);
      expect(respondToUserInput).toHaveBeenCalledTimes(1);
    });

    it('keeps checking while checks fail before the first answer', async () => {
      const failed = MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        statusCode: 500,
      });
      renderBlock({failureReason: 'repo_not_in_sentry'});
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      expect(failed).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('Checking whether Seer can access acme/app')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Continue without code'})
      ).not.toBeInTheDocument();

      // The check works again.
      MockApiClient.clearMockResponses();
      mockRepoAccess('repo_not_in_sentry');
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
    });

    it('keeps the last answer up when a later check fails', async () => {
      mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      MockApiClient.clearMockResponses();
      const failed = MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        statusCode: 500,
      });
      await act(() => jest.advanceTimersByTimeAsync(6_000));

      expect(failed).toHaveBeenCalled();
      expect(screen.getByText("Seer can't access acme/app")).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Continue without code'})
      ).toBeInTheDocument();
    });

    it('stops checking after 10 minutes', async () => {
      const check = mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));
      const checks = check.mock.calls.length;
      await act(() => jest.advanceTimersByTimeAsync(60_000));

      expect(check).toHaveBeenCalledTimes(checks);
      expect(screen.getByText('Stopped checking every few seconds.')).toBeInTheDocument();
    });

    it('checks again on Check again after it stopped', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      mockRepoAccess('repo_not_in_sentry');
      const respondToUserInput = renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
      await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

      // The repo reached Sentry after the popup stopped checking.
      MockApiClient.clearMockResponses();
      const check = mockRepoAccess('found');
      await user.click(screen.getByRole('button', {name: 'Check again'}));

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(check).toHaveBeenCalledTimes(1);
      expect(respondToUserInput).toHaveBeenCalledWith(
        'input-id',
        {decision: 'retry'},
        retryOptions
      );
      expect(
        screen.queryByText('Stopped checking every few seconds.')
      ).not.toBeInTheDocument();
    });

    it('checks once without restarting polling after Check again', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      const check = mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
      await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

      await user.click(screen.getByRole('button', {name: 'Check again'}));
      await act(() => jest.advanceTimersByTimeAsync(0));
      const checks = check.mock.calls.length;
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      expect(check).toHaveBeenCalledTimes(checks);
      expect(screen.getByRole('button', {name: 'Check again'})).toBeInTheDocument();
    });

    it("lets a member request again when what's wrong changes", async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      mockRepoAccess('no_scm_integration');
      const request = MockApiClient.addMockResponse({
        url: INTEGRATION_REQUEST_URL,
        method: 'POST',
        statusCode: 201,
      });
      renderBlock({org: memberOrganization});
      await user.click(await screen.findByRole('button', {name: 'Request installation'}));
      expect(
        await screen.findByRole('button', {name: 'Installation requested'})
      ).toBeDisabled();

      // An owner connected an account, but not the repo's.
      MockApiClient.clearMockResponses();
      mockRepoAccess('scm_account_not_connected', ['other-org']);
      MockApiClient.addMockResponse({
        url: INTEGRATION_REQUEST_URL,
        method: 'POST',
        statusCode: 201,
      });
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      expect(
        await screen.findByText(
          "This repo's account isn't connected to this organization. Connected: other-org."
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Request installation'})).toBeEnabled();
      expect(request).toHaveBeenCalledTimes(1);
    });

    describe('when it stops without an answer', () => {
      beforeEach(() => {
        MockApiClient.addMockResponse({url: REPO_ACCESS_URL, statusCode: 500});
      });

      it("says it couldn't check", async () => {
        renderBlock({failureReason: 'repo_not_in_sentry'});
        await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

        expect(
          screen.getByText("Couldn't check whether Seer can access acme/app")
        ).toBeInTheDocument();
        expect(
          screen.queryByText('Checking whether Seer can access acme/app')
        ).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Check again'})).toBeInTheDocument();
        expect(
          screen.getByRole('button', {name: 'Correct repo name'})
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', {name: 'Continue without code'})
        ).toBeInTheDocument();
      });

      it('retries on Continue', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        const respondToUserInput = renderBlock({failureReason: 'repo_not_in_sentry'});
        await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

        await user.click(screen.getByRole('button', {name: 'Continue'}));

        expect(respondToUserInput).toHaveBeenCalledWith('input-id', {decision: 'retry'});
      });

      it('checks again on Check again', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        renderBlock({failureReason: 'repo_not_in_sentry'});
        await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

        // The check works again.
        MockApiClient.clearMockResponses();
        const check = mockRepoAccess('found');
        await user.click(screen.getByRole('button', {name: 'Check again'}));

        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(check).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('keeps the answer when the chat moves', async () => {
    function MovingChat() {
      const [place, setPlace] = useState('sidebar');
      return (
        <Fragment>
          <Button onClick={() => setPlace('popped out')}>Pop out</Button>
          <ConnectScmBlock
            key={place}
            pendingInput={{
              id: 'input-id',
              input_type: 'connect_scm',
              data: {repo_name: 'acme/app', failure_reason: 'repo_not_in_sentry'},
            }}
            respondToUserInput={jest.fn()}
          />
        </Fragment>
      );
    }
    mockRepoAccess('repo_not_in_sentry');
    render(<MovingChat />, {organization, additionalWrapper: PictureInPictureProvider});
    expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

    // The check after the move doesn't come back.
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: REPO_ACCESS_URL,
      statusCode: 500,
      asyncDelay: new Promise<void>(() => {}),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Pop out'}));

    expect(screen.getByText("Seer can't access acme/app")).toBeInTheDocument();
    expect(
      screen.queryByText('Checking whether Seer can access acme/app')
    ).not.toBeInTheDocument();
  });

  describe('after an earlier pause for the same repo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        cleanup();
        // The popup's own timers update its state.
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

    function Pauses() {
      const [inputId, setInputId] = useState('earlier-input-id');
      return (
        <Fragment>
          <Button onClick={() => setInputId('input-id')}>Pause again</Button>
          <ConnectScmBlock
            key={inputId}
            pendingInput={{
              id: inputId,
              input_type: 'connect_scm',
              data: {repo_name: 'acme/app', failure_reason: 'repo_not_in_sentry'},
            }}
            respondToUserInput={jest.fn()}
          />
        </Fragment>
      );
    }

    it("doesn't count a check the earlier pause started", async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      let answerEarlierCheck = () => {};
      MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        body: {status: 'found', connectedAccounts: []},
        asyncDelay: new Promise<void>(resolve => {
          answerEarlierCheck = resolve;
        }),
      });
      render(<Pauses />, {organization, additionalWrapper: PictureInPictureProvider});

      // The run paused again before the earlier pause's check came back.
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        body: {status: 'repo_not_in_sentry', connectedAccounts: []},
        asyncDelay: new Promise<void>(() => {}),
      });
      await user.click(screen.getByRole('button', {name: 'Pause again'}));
      answerEarlierCheck();
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      expect(
        screen.getByText('Checking whether Seer can access acme/app')
      ).toBeInTheDocument();
    });

    it("waits for this pause's check instead of showing the earlier answer", async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      const ready = mockRepoAccess('found');
      render(<Pauses />, {organization, additionalWrapper: PictureInPictureProvider});
      await waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

      // The run tried the call again, it failed again, and the run paused on the same repo.
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      MockApiClient.clearMockResponses();
      let answer = () => {};
      MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        body: {status: 'scm_account_not_connected', connectedAccounts: ['acme-labs']},
        asyncDelay: new Promise<void>(resolve => {
          answer = resolve;
        }),
      });
      await user.click(screen.getByRole('button', {name: 'Pause again'}));

      expect(
        screen.getByText('Checking whether Seer can access acme/app')
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();

      answer();
      expect(
        await screen.findByText(
          "This repo's account isn't connected to this organization. Connected: acme-labs."
        )
      ).toBeInTheDocument();
    });
  });

  it('answers when continuing without the code', async () => {
    mockRepoAccess('no_scm_integration');
    const respondToUserInput = renderBlock();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Continue without code'})
    );

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {decision: 'skip'});
  });

  it('sends the corrected name', async () => {
    mockRepoAccess('repo_not_in_sentry');
    const respondToUserInput = renderBlock({failureReason: 'repo_not_in_sentry'});

    await userEvent.click(await screen.findByRole('button', {name: 'Correct repo name'}));
    const field = screen.getByRole('textbox', {name: 'Repository name'});
    expect(field).toHaveValue('acme/app');
    await userEvent.clear(field);
    await userEvent.type(field, 'acme/real');
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {
      decision: 'correct_repo',
      repo_name: 'acme/real',
    });
  });
});
