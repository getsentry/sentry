import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {JiraIntegrationFixture} from 'sentry-fixture/jiraIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PlatformExternalIssueFixture} from 'sentry-fixture/platformExternalIssue';
import {ProjectFixture} from 'sentry-fixture/project';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SentryAppComponentsStore} from 'sentry/stores/sentryAppComponentsStore';
import {SentryAppInstallationStore} from 'sentry/stores/sentryAppInstallationsStore';
import type {GroupIntegration} from 'sentry/types/integrations';

import {ExternalIssueSidebarList} from './externalIssueSidebarList';

describe('ExternalIssueSidebarList', () => {
  const organization = OrganizationFixture();
  const organizationWithLinkedPullRequestsFeature = OrganizationFixture({
    features: ['issue-details-linked-pull-requests'],
  });
  const event = EventFixture();
  const group = GroupFixture();
  const project = ProjectFixture();

  function mockLinkedPullRequestsFeatureRequests(integrations: GroupIntegration[]) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: integrations,
    });
  }

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

  it('should render issue tracker actions in the section header', async () => {
    const asanaComponent = SentryAppComponentFixture({
      sentryApp: {
        ...SentryAppComponentFixture().sentryApp,
        slug: 'asana',
        name: 'Asana',
      },
    });
    SentryAppComponentsStore.loadComponents([asanaComponent]);
    SentryAppInstallationStore.load([
      SentryAppInstallationFixture({
        app: asanaComponent.sentryApp,
      }),
    ]);
    mockLinkedPullRequestsFeatureRequests([
      GitHubIntegrationFixture({
        status: 'active',
        externalIssues: [],
        name: 'GitHub sentry',
      }),
      JiraIntegrationFixture({
        id: '2',
        status: 'active',
        externalIssues: [],
        name: 'Jira Integration',
        domainName: 'example.com',
      }),
    ]);

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />, {
      organization: organizationWithLinkedPullRequestsFeature,
    });

    expect(await screen.findByText('External Links')).toBeInTheDocument();
    expect(screen.queryByText('Issue Tracking')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Link issue'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'GitHub'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Jira'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Link issue'}));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('separator')).toHaveLength(2);
    expect(await screen.findByRole('menuitemradio', {name: 'Asana'})).toBeInTheDocument();
    expect(
      await screen.findByRole('menuitemradio', {name: 'GitHub'})
    ).toBeInTheDocument();
    expect(await screen.findByRole('menuitemradio', {name: 'Jira'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Create Issue'})
    ).not.toBeInTheDocument();
  });

  it('should open the integration modal directly when there is one issue tracker action', async () => {
    mockLinkedPullRequestsFeatureRequests([
      GitHubIntegrationFixture({
        id: '1',
        status: 'active',
        externalIssues: [],
        name: 'GitHub sentry',
      }),
    ]);
    const configMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/1/`,
      match: [MockApiClient.matchQuery({action: 'create'})],
      body: {createIssueConfig: [], linkIssueConfig: []},
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />, {
      organization: organizationWithLinkedPullRequestsFeature,
    });
    renderGlobalModal({organization: organizationWithLinkedPullRequestsFeature});

    await userEvent.click(await screen.findByRole('button', {name: 'Link issue'}));

    expect(screen.queryByRole('menuitemradio', {name: 'GitHub'})).not.toBeInTheDocument();
    await waitFor(() => {
      expect(configMock).toHaveBeenCalledTimes(1);
    });
  });

  it('should render linked issues as full-width rows', async () => {
    const issueKey = 'DE#1275';
    const issueTitle = 'Linear: DE#1275';
    mockLinkedPullRequestsFeatureRequests([
      GitHubIntegrationFixture({
        status: 'active',
        externalIssues: [
          {
            id: '321',
            key: issueKey,
            url: 'https://linear.app/example/issue/DE-1275',
            title: issueTitle,
            description: 'something else, sorry',
            displayName: '',
          },
        ],
      }),
    ]);

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />, {
      organization: organizationWithLinkedPullRequestsFeature,
    });

    const linkedIssues = await screen.findByRole('list', {name: 'Linked issues'});
    expect(within(linkedIssues).getByRole('link', {name: issueTitle})).toHaveAttribute(
      'href',
      'https://linear.app/example/issue/DE-1275'
    );
    expect(within(linkedIssues).queryByText(issueKey)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: issueKey})).not.toBeInTheDocument();
    expect(
      within(linkedIssues).getByRole('button', {name: `Unlink ${issueTitle}`})
    ).toBeInTheDocument();
  });

  it('should render an external links empty state', async () => {
    mockLinkedPullRequestsFeatureRequests([
      GitHubIntegrationFixture({
        status: 'active',
        externalIssues: [],
        name: 'GitHub sentry',
      }),
    ]);

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />, {
      organization: organizationWithLinkedPullRequestsFeature,
    });

    expect(await screen.findByRole('button', {name: 'Link issue'})).toBeInTheDocument();
    expect(
      screen.queryByText('No linked issues or pull requests')
    ).not.toBeInTheDocument();
  });

  it('should render empty state when no integrations', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });

    render(<ExternalIssueSidebarList event={event} group={group} project={project} />, {
      organization: organizationWithLinkedPullRequestsFeature,
    });

    expect(
      await screen.findByText('Track this issue in Jira, GitHub, etc.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No linked issues or pull requests')
    ).not.toBeInTheDocument();
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
