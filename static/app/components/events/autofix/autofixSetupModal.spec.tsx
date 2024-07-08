import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixSetupModal} from 'sentry/components/events/autofix/autofixSetupModal';
import {AutofixCodebaseIndexingStatus} from 'sentry/components/events/autofix/types';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('AutofixSetupModal', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/autofix/codebase-index/status/',
      body: {
        status: AutofixCodebaseIndexingStatus.NOT_INDEXED,
      },
    });
  });

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

  it('displays indexing error when one exists', async function () {
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

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/autofix/codebase-index/status/',
      body: {
        status: AutofixCodebaseIndexingStatus.ERRORED,
        reason: 'Some error',
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
      await screen.findByText(/Failed to index repositories: Some error/i)
    ).toBeInTheDocument();
  });

  it('shows codebase index button when every other step is done', async function () {
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
        codebaseIndexing: {ok: false},
      },
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/autofix/codebase-index/create/',
      method: 'POST',
      body: {
        success: true,
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
      await screen.findByText('Index Repositories & Enable Autofix')
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Index Repositories & Enable Autofix'})
    );

    expect(closeModal).toHaveBeenCalled();
  });

  it('does not show codebase index step if flag is present', async function () {
    const {organization} = initializeOrg({
      organization: {
        features: ['autofix-disable-codebase-indexing'],
      },
    } as any);

    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: false,
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

    renderGlobalModal({organization});

    act(() => {
      openModal(
        modalProps => <AutofixSetupModal {...modalProps} groupId="1" projectId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    expect(await screen.findByText('Skip & Enable Autofix')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Skip & Enable Autofix'}));

    expect(closeModal).toHaveBeenCalled();
  });
});
