import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Group as GroupFixture} from 'sentry-fixture/group';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ExternalIssueActions from 'sentry/components/group/externalIssuesList/externalIssueActions';

describe('ExternalIssueActions', function () {
  const group = GroupFixture();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('with no external issues linked', function () {
    const integration = GitHubIntegrationFixture({externalIssues: []});
    const configurations = [integration];

    it('renders', function () {
      render(
        <ExternalIssueActions
          key="github"
          group={group}
          configurations={configurations}
          onChange={() => {}}
        />
      );

      // renders GitHub Issue when no issues currently linked
      expect(screen.getByText('GitHub Issue')).toBeInTheDocument();
    });

    it('opens hovercard', async function () {
      render(
        <ExternalIssueActions
          key="github"
          group={group}
          configurations={configurations}
          onChange={() => {}}
        />
      );

      await userEvent.hover(screen.getByText('GitHub Issue'));
      expect(await screen.findByText('GitHub Integration')).toBeInTheDocument();
      expect(screen.getByText('github.com/test-integration')).toBeInTheDocument();
    });

    it('opens modal', async function () {
      const integrationConfigMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/integrations/1/',
        body: {createIssueConfig: []},
      });

      render(
        <ExternalIssueActions
          key="github"
          group={group}
          configurations={configurations}
          onChange={() => {}}
        />
      );
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Add'}));
      expect(await screen.findByText('Create Issue')).toBeInTheDocument();
      expect(integrationConfigMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('with an external issue linked', function () {
    const externalIssues = [
      {
        id: '100',
        url: 'https://github.com/MeredithAnya/testing/issues/2',
        key: 'getsentry/sentry#2',
        title: 'SyntaxError: XYZ',
        description: 'something else, sorry',
        displayName: '',
      },
    ];
    const integration = GitHubIntegrationFixture({externalIssues});
    const configurations = [integration];
    it('renders', function () {
      render(
        <ExternalIssueActions
          key="github"
          group={group}
          configurations={configurations}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('getsentry/sentry#2')).toBeInTheDocument();
    });

    it('deletes when clicking x', async function () {
      const mockDelete = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/integrations/1/?externalIssue=100',
        method: 'DELETE',
      });

      render(
        <ExternalIssueActions
          key="github"
          group={group}
          configurations={configurations}
          onChange={() => {}}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Close'}));
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });
});
