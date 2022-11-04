import {render, screen} from 'sentry-test/reactTestingLibrary';

import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';

import ExternalIssuesList from './externalIssuesList';

describe('ExternalIssuesList', () => {
  const event = TestStubs.Event();
  const group = TestStubs.Group();
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();

  beforeEach(() => {
    SentryAppInstallationStore.init!();
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  const setupCTA = 'Track this issue in Jira, GitHub, etc.';

  it('renders setup CTA', () => {
    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/groups/1/external-issues/',
      body: [],
    });
    render(
      <ExternalIssuesList
        components={[]}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );
    expect(screen.getByText(setupCTA)).toBeInTheDocument();
  });

  it('renders sentry app issues', () => {
    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/external-issues/`,
      body: [],
    });
    const component = TestStubs.SentryAppComponent();
    SentryAppInstallationStore.load([
      TestStubs.SentryAppInstallation({
        app: component.sentryApp,
      }),
    ]);
    render(
      <ExternalIssuesList
        components={[component]}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );
    expect(screen.queryByText(setupCTA)).not.toBeInTheDocument();
    expect(screen.getByText('Foo Issue')).toBeInTheDocument();
  });

  it('renders integrations with issues first', async () => {
    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/integrations/`,
      body: [
        TestStubs.JiraIntegration({status: 'active', externalIssues: []}),
        TestStubs.GitHubIntegration({
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
      url: `/groups/${group.id}/external-issues/`,
      body: [],
    });
    const component = TestStubs.SentryAppComponent();
    render(
      <ExternalIssuesList
        components={[component]}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );
    expect(await screen.findByText('Test-Sentry/github-test#13')).toBeInTheDocument();
    const externalIssues = screen.getAllByTestId('external-issue-item');
    expect(externalIssues[0]).toHaveTextContent('Test-Sentry/github-test#13');
    expect(externalIssues[1]).toHaveTextContent('Jira Issue');
  });
});
