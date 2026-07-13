import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {JiraIntegrationFixture} from 'sentry-fixture/jiraIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SentryAppInstallationStore} from 'sentry/stores/sentryAppInstallationsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useSentryAppComponentsStore} from 'sentry/utils/useSentryAppComponentsStore';

import {ExternalIssueList} from '.';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/utils/useSentryAppComponentsStore');
const mockUseSentryAppComponentsStore = jest.mocked(useSentryAppComponentsStore);

describe('ExternalIssueList', () => {
  const event = EventFixture();
  const group = GroupFixture();
  const organization = OrganizationFixture();

  beforeEach(() => {
    SentryAppInstallationStore.init();
    mockUseSentryAppComponentsStore.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders setup CTA', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/external-issues/`,
      body: [],
    });
    render(
      <ExternalIssueList analyticsView="issue_details" group={group} event={event} />,
      {organization}
    );
    expect(await screen.findByRole('link', {name: 'Jira, GitHub, etc.'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/integrations/?category=issue%20tracking`
    );

    const customIntegrationLink = screen.getByRole('link', {
      name: 'custom integration',
    });
    expect(customIntegrationLink).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/developer-settings/new-internal/?referrer=external_issue_empty_state`
    );

    await userEvent.click(customIntegrationLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'integrations.external_issue_custom_integration_cta_clicked',
      expect.objectContaining({view: 'issue_details'})
    );
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
    render(
      <ExternalIssueList analyticsView="issue_details" group={group} event={event} />,
      {organization}
    );
    expect(await screen.findByRole('button', {name: 'Foo'})).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Jira, GitHub, etc.'})
    ).not.toBeInTheDocument();
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
    render(
      <ExternalIssueList analyticsView="issue_details" group={group} event={event} />,
      {organization}
    );
    expect(
      await screen.findByRole('link', {name: 'Test-Sentry/github-test#13'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Jira'})).toBeInTheDocument();
  });
});
