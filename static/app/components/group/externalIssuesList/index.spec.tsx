import {Event} from 'sentry-fixture/event';
import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Group} from 'sentry-fixture/group';
import {JiraIntegration} from 'sentry-fixture/jiraIntegration';
import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';
import {SentryAppComponent} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallation} from 'sentry-fixture/sentryAppInstallation';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

import ExternalIssuesList from '.';

jest.mock('sentry/utils/useSentryAppComponentsStore');
const mockUseSentryAppComponentsStore = jest.mocked(useSentryAppComponentsStore);

describe('ExternalIssuesList', () => {
  const event = Event();
  const group = Group();
  const project = Project();
  const organization = Organization();

  beforeEach(() => {
    SentryAppInstallationStore.init!();
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
    const component = SentryAppComponent();
    SentryAppInstallationStore.load([
      SentryAppInstallation({
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
        JiraIntegration({status: 'active', externalIssues: []}),
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
    const component = SentryAppComponent();
    mockUseSentryAppComponentsStore.mockReturnValue([component]);
    render(<ExternalIssuesList group={group} project={project} event={event} />, {
      organization,
    });
    expect(await screen.findByText('Test-Sentry/github-test#13')).toBeInTheDocument();
    const externalIssues = screen.getAllByTestId('external-issue-item');
    expect(externalIssues[0]).toHaveTextContent('Test-Sentry/github-test#13');
    expect(externalIssues[1]).toHaveTextContent('Jira Issue');
  });
});
