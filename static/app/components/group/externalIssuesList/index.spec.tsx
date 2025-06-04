import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {JiraIntegrationFixture} from 'sentry-fixture/jiraIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import type {Group} from 'sentry/types/group';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

import ExternalIssuesList from '.';

jest.mock('sentry/utils/useSentryAppComponentsStore');
const mockUseSentryAppComponentsStore = jest.mocked(useSentryAppComponentsStore);

describe('ExternalIssuesList', () => {
  const event = EventFixture();
  const group = GroupFixture();
  const project = ProjectFixture();
  const organization = OrganizationFixture();

  beforeEach(() => {
    SentryAppInstallationStore.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  const setupCTA = 'Track this issue in Jira, GitHub, etc.';

  it('renders setup CTA', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/external-issues/`,
      body: [],
    });
    mockUseSentryAppComponentsStore.mockReturnValue([]);
    render(<ExternalIssuesList group={group} project={project} event={event} />, {
      organization,
    });
    expect(await screen.findByText(setupCTA)).toBeInTheDocument();
  });

  it('renders sentry app issues', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
    const component = SentryAppComponentFixture();
    SentryAppInstallationStore.load([
      SentryAppInstallationFixture({
        app: component.sentryApp,
      }),
    ]);
    mockUseSentryAppComponentsStore.mockReturnValue([component]);
    render(<ExternalIssuesList group={group} project={project} event={event} />, {
      organization,
    });
    expect(await screen.findByText('Foo Issue')).toBeInTheDocument();
    expect(screen.queryByText(setupCTA)).not.toBeInTheDocument();
  });

  it('renders integrations with issues first', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [
        JiraIntegrationFixture({status: 'active', externalIssues: []}),
        GitHubIntegrationFixture({
          status: 'active',
          externalIssues: [
            {
              id: '321',
              key: 'Test-Sentry/github-test#13',
              url: 'https://github.com/Test-Sentry/github-test/issues/13',
              title: 'SyntaxError: XYZ',
              description: 'something else, sorry',
              displayName: '',
            },
          ],
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
    const component = SentryAppComponentFixture();
    mockUseSentryAppComponentsStore.mockReturnValue([component]);
    render(<ExternalIssuesList group={group} project={project} event={event} />, {
      organization,
    });
    expect(await screen.findByText('Test-Sentry/github-test#13')).toBeInTheDocument();
    const externalIssues = screen.getAllByTestId('external-issue-item');
    expect(externalIssues[0]).toHaveTextContent('Test-Sentry/github-test#13');
    expect(externalIssues[1]).toHaveTextContent('Jira Issue');
  });

  it('renders group plugin issues', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });

    // Create a group with plugin issues
    const groupWithPluginIssues: Group = {
      ...group,
      pluginIssues: [
        {
          id: 'trello',
          name: 'Trello',
          slug: 'trello',
          shortName: 'Trello',
          title: 'Trello',
          canDisable: true,
          contexts: [],
          doc: '',
          enabled: true,
          featureDescriptions: [],
          features: [],
          hasConfiguration: true,
          isDeprecated: false,
          isHidden: false,
          isTestable: true,
          metadata: {},
          status: 'active',
          type: 'issue-tracking',
          issue: {
            issue_id: 'TRL-123',
            url: 'https://trello.com/c/123456/card-title',
            label: 'TRL-123',
          },
        },
      ],
      pluginActions: [],
    };

    render(
      <ExternalIssuesList
        group={groupWithPluginIssues}
        project={project}
        event={event}
      />,
      {organization}
    );

    expect(await screen.findByText('TRL-123')).toBeInTheDocument();
  });
});
