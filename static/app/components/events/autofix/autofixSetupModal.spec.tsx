import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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

    render(<AutofixSetupContent groupId="1" projectId="1" />);

    expect(await screen.findByText('Install the GitHub Integration')).toBeInTheDocument();
    expect(
      screen.getByText(/Install the GitHub integration by navigating to/)
    ).toBeInTheDocument();
  });
});
