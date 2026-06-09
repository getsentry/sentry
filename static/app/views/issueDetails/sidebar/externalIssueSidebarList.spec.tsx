import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {JiraIntegrationFixture} from 'sentry-fixture/jiraIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PlatformExternalIssueFixture} from 'sentry-fixture/platformExternalIssue';
import {ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SentryAppComponentsStore} from 'sentry/stores/sentryAppComponentsStore';
import {SentryAppInstallationStore} from 'sentry/stores/sentryAppInstallationsStore';

import {ExternalIssueSidebarList} from './externalIssueSidebarList';

describe('ExternalIssueSidebarList', () => {
  const organization = OrganizationFixture();
  const event = EventFixture();
  const group = GroupFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SentryAppComponentsStore.init();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
  });

  it('should allow unlinking integration external issues', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/external-issues/`,
      body: [],
    });

    const issueKey = 'Test-Sentry/github-test#13';
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [
        GitHubIntegrationFixture({
          status: 'active',
          externalIssues: [
            {
              id: '321',
              key: issueKey,
              url: 'https://github.com/Test-Sentry/github-test/issues/13',
              title: 'SyntaxError: XYZ',
              description: 'something else, sorry',
              displayName: '',
            },
          ],
        }),
      ],
    });
    const unlinkMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/1/`,
      query: {externalIssue: '321'},
      method: 'DELETE',
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />);

    expect(await screen.findByRole('button', {name: issueKey})).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', {name: issueKey}));

    // Integrations are refetched, remove the external issue from the object
    const refetchMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [
        GitHubIntegrationFixture({
          status: 'active',
          externalIssues: [],
        }),
      ],
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Unlink issue'}));

    await waitFor(() => {
      expect(screen.queryByRole('button', {name: issueKey})).not.toBeInTheDocument();
    });
    expect(unlinkMock).toHaveBeenCalledTimes(1);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('should allow unlinking sentry app issues', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/external-issues/`,
      body: [
        PlatformExternalIssueFixture({
          id: '1',
          issueId: '1',
          serviceType: 'clickup',
          displayName: 'ClickUp: hello#1',
          webUrl: 'https://app.clickup.com/t/1',
        }),
      ],
    });

    const unlinkMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/external-issues/1/`,
      method: 'DELETE',
    });

    const component = SentryAppComponentFixture({
      sentryApp: {
        ...SentryAppComponentFixture().sentryApp,
        slug: 'clickup',
        name: 'Clickup',
      },
    });
    SentryAppComponentsStore.loadComponents([component]);
    SentryAppInstallationStore.load([
      SentryAppInstallationFixture({
        app: component.sentryApp,
      }),
    ]);

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />);

    expect(
      await screen.findByRole('button', {name: 'ClickUp: hello#1'})
    ).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', {name: 'ClickUp: hello#1'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Unlink issue'}));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {name: 'ClickUp: hello#1'})
      ).not.toBeInTheDocument();
    });
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it('should combine multiple integration configurations into a single dropdown', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [
        GitHubIntegrationFixture({
          status: 'active',
          externalIssues: [],
          name: 'GitHub sentry',
        }),
        GitHubIntegrationFixture({
          id: '2',
          status: 'active',
          externalIssues: [],
          name: 'GitHub codecov',
        }),
      ],
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />);

    expect(await screen.findByRole('button', {name: 'GitHub'})).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'GitHub'}));

    // Both items are listed inside the dropdown
    expect(
      await screen.findByRole('menuitemradio', {name: /GitHub sentry/})
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('menuitemradio', {name: /GitHub codecov/})
    ).toBeInTheDocument();
  });

  it('should render empty state when no integrations', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />);

    expect(
      await screen.findByText('Track this issue in Jira, GitHub, etc.')
    ).toBeInTheDocument();
  });

  it('should not request linked pull requests when the feature is disabled', async () => {
    const pullRequestsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />, {
      organization,
    });

    expect(
      await screen.findByText('Track this issue in Jira, GitHub, etc.')
    ).toBeInTheDocument();
    expect(pullRequestsMock).not.toHaveBeenCalled();
  });

  it('should render linked pull requests when the feature is enabled', async () => {
    const organizationWithFeature = OrganizationFixture({
      features: ['issue-details-linked-pull-requests'],
    });
    const repository = RepositoryFixture({
      id: '42',
      name: 'getsentry/sentry',
      provider: {id: 'integrations:github', name: 'GitHub'},
    });
    const pullRequest = PullRequestFixture({
      id: '115619',
      title: 'fix(issues): Render assigned user linked pull requests',
      repository,
      externalUrl: 'https://github.com/getsentry/sentry/pull/115619',
    });
    const closedPullRequest = PullRequestFixture({
      id: '115618',
      title: 'fix(members): Ignore detail response',
      repository,
      externalUrl: 'https://github.com/getsentry/sentry/pull/115618',
    });
    const pullRequestsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organizationWithFeature.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...pullRequest,
            dateLinked: '2026-06-08T23:11:32.000000Z',
            status: 'merged',
          },
          {
            ...closedPullRequest,
            dateLinked: '2026-06-08T23:10:32.000000Z',
            status: 'closed',
          },
        ],
      },
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />, {
      organization: organizationWithFeature,
    });

    const linkedPullRequest = await screen.findByRole('link', {
      name: /fix\(issues\): Render assigned user linked pull requests/,
    });

    expect(linkedPullRequest).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/115619'
    );
    expect(screen.getByText('#115619')).toBeInTheDocument();
    expect(screen.getByText('#115618')).toBeInTheDocument();
    expect(screen.getAllByText('getsentry/sentry')).toHaveLength(2);
    expect(screen.getByTestId('linked-pull-request-status-merged')).toBeInTheDocument();
    expect(screen.getByTestId('linked-pull-request-status-closed')).toBeInTheDocument();
    expect(pullRequestsMock).toHaveBeenCalledTimes(1);
  });

  it('should render dropdown items with subtext correctly', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [
        JiraIntegrationFixture({
          id: '1',
          status: 'active',
          externalIssues: [],
          name: 'Jira Integration 1',
          domainName: 'hello.com',
        }),
        JiraIntegrationFixture({
          id: '2',
          status: 'active',
          externalIssues: [],
          name: 'Jira',
          domainName: 'example.com',
        }),
      ],
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />);

    expect(await screen.findByRole('button', {name: 'Jira'})).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'Jira'}));

    // Item with different name and subtext should show both
    const menuItem = await screen.findByRole('menuitemradio', {
      name: /Jira Integration 1/,
    });
    expect(menuItem).toHaveTextContent('hello.com');

    // Item with name matching integration name should only show subtext
    expect(screen.getByRole('menuitemradio', {name: 'example.com'})).toBeInTheDocument();
  });

  it('should render links to group.pluginActions', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });

    const groupWithPluginActions = GroupFixture({
      pluginActions: [['Create Redmine Issue', '/path/to/redmine']],
    });
    render(
      <ExternalIssueSidebarList
        event={event}
        group={groupWithPluginActions}
        project={project}
      />
    );

    expect(
      await screen.findByRole('button', {name: 'Create Redmine Issue'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create Redmine Issue'})).toHaveAttribute(
      'href',
      '/path/to/redmine'
    );
  });
});
