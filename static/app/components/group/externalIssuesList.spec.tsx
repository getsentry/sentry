import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';

import ExternalIssuesList from './externalIssuesList';

describe('ExternalIssuesList', () => {
  const event = TestStubs.Event();
  const group = TestStubs.Group();
  const project = TestStubs.Project();
  const components = [TestStubs.SentryAppComponent()];
  const organization = TestStubs.Organization();

  beforeEach(() => {});

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
  });
});
