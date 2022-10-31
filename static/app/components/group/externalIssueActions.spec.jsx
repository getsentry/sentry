import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ExternalIssueActions from 'sentry/components/group/externalIssueActions';

describe('ExternalIssueActions', function () {
  const group = TestStubs.Group();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('with no external issues linked', function () {
    const integration = TestStubs.GitHubIntegration({externalIssues: []});
    const configurations = [integration];

    it('renders', function () {
      const {container} = render(
        <ExternalIssueActions
          key="github"
          group={group}
          configurations={configurations}
          onChange={() => {}}
        />
      );

      expect(container).toSnapshot();
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

      userEvent.hover(screen.getByText('GitHub Issue'));
      expect(await screen.findByText('GitHub Integration')).toBeInTheDocument();
      expect(screen.getByText('github.com/test-integration')).toBeInTheDocument();
    });

    it('opens modal', async function () {
      const integrationConfigMock = MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/',
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

      userEvent.click(screen.getByRole('button', {name: 'Add'}));
      expect(await screen.findByText('Create Issue')).toBeInTheDocument();
      expect(integrationConfigMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('with an external issue linked', function () {
    const externalIssues = [
      {
        id: 100,
        url: 'https://github.com/MeredithAnya/testing/issues/2',
        key: 'getsentry/sentry#2',
      },
    ];
    const integration = TestStubs.GitHubIntegration({externalIssues});
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

    it('deletes when clicking x', function () {
      const mockDelete = MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/?externalIssue=100',
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

      userEvent.click(screen.getByRole('button', {name: 'Close'}));
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });
});
