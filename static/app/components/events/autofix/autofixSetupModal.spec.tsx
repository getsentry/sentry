import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixSetupContent} from 'sentry/components/events/autofix/autofixSetupModal';
import {AutofixCodebaseIndexingStatus} from 'sentry/components/events/autofix/types';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('AutofixSetupContent', function () {
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
      },
    });

    const onComplete = jest.fn();

    render(<AutofixSetupContent groupId="1" projectId="1" onComplete={onComplete} />);

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
      },
    });

    const onComplete = jest.fn();

    render(<AutofixSetupContent groupId="1" projectId="1" onComplete={onComplete} />);

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
      },
    });

    const onComplete = jest.fn();

    render(<AutofixSetupContent groupId="1" projectId="1" onComplete={onComplete} />);

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
      },
    });

    const onComplete = jest.fn();

    render(<AutofixSetupContent groupId="1" projectId="1" onComplete={onComplete} />);

    await screen.findByText('Allow Autofix to Make Pull Requests');

    expect(
      await screen.findByText(/for the following repositories:/)
    ).toBeInTheDocument();
    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(await screen.findByText('getsentry/seer')).toBeInTheDocument();
  });
});
