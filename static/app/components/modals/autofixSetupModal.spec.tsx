import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixSetupModal} from 'sentry/components/modals/autofixSetupModal';

describe('AutofixSetupModal', function () {
  it('renders the integration setup instructions', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: false},
        githubWriteIntegration: {
          ok: false,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              external_id: '123',
              ok: false,
            },
          ],
        },
        codebaseIndexing: {ok: false},
      },
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupModal {...modalProps} groupId="1" projectId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    expect(await screen.findByText('Install the GitHub Integration')).toBeInTheDocument();
    expect(
      screen.getByText(/Install the GitHub integration by navigating to/)
    ).toBeInTheDocument();
  });

  it('displays successful integration text when it is installed', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: false},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: false,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              external_id: '123',
              ok: false,
            },
          ],
        },
        codebaseIndexing: {ok: false},
      },
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupModal {...modalProps} groupId="1" projectId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    await screen.findByText('Install the GitHub Integration');

    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    expect(
      await screen.findByText(/The GitHub integration is already installed/)
    ).toBeInTheDocument();
  });

  it('displays pending repos for github app text', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: false},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: false,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              external_id: '123',
              ok: true,
            },
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'seer',
              external_id: '235',
              ok: false,
            },
          ],
        },
        codebaseIndexing: {ok: false},
      },
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupModal {...modalProps} groupId="1" projectId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(await screen.findByText('getsentry/seer')).toBeInTheDocument();
  });

  it('displays success repos for github app text', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: false},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: true,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              external_id: '123',
              ok: true,
            },
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'seer',
              external_id: '235',
              ok: true,
            },
          ],
        },
        codebaseIndexing: {ok: false},
      },
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupModal {...modalProps} groupId="1" projectId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    await screen.findByText('Install the GitHub Integration');

    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    expect(
      await screen.findByText(/has been installed on all required repositories/)
    ).toBeInTheDocument();
    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(await screen.findByText('getsentry/seer')).toBeInTheDocument();
  });

  it('displays indexing option', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: false},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: true,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              external_id: '123',
              ok: true,
            },
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'seer',
              external_id: '235',
              ok: true,
            },
          ],
        },
        codebaseIndexing: {ok: false},
      },
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupModal {...modalProps} groupId="1" projectId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    await screen.findByText('Enable Autofix');

    expect(
      await screen.findByText(/Sentry will index your repositories to enable Autofix./)
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Index Repositories & Enable Autofix'})
    ).toBeInTheDocument();
  });

  it('shows success text when steps are done', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: true,
          repos: [
            {
              provider: 'integrations:github',
              repo: 'getsentry',
              name: 'sentry',
              external_id: '123',
            },
          ],
        },
        codebaseIndexing: {ok: true},
      },
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupModal {...modalProps} groupId="1" projectId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    expect(
      await screen.findByText("You've successfully configured Autofix!")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: "Let's go"}));

    expect(closeModal).toHaveBeenCalled();
  });
});
