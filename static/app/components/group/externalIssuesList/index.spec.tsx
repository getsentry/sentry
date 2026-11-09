import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {JiraIntegrationFixture} from 'sentry-fixture/jiraIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ExternalIssueList} from '.';

describe('ExternalIssueList', () => {
  const event = EventFixture();
  const group = GroupFixture();
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sentry-app-components/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sentry-app-installations/`,
      body: [],
    });
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
    render(<ExternalIssueList group={group} event={event} />, {
      organization,
    });
    expect(await screen.findByRole('link', {name: setupCTA})).toBeInTheDocument();
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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sentry-app-components/`,
      body: [component],
    });
    render(<ExternalIssueList group={group} event={event} />, {
      organization,
    });
    expect(await screen.findByRole('button', {name: 'Foo'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: setupCTA})).not.toBeInTheDocument();
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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sentry-app-components/`,
      body: [component],
    });
    render(<ExternalIssueList group={group} event={event} />, {
      organization,
    });
    expect(
      await screen.findByRole('link', {name: 'Test-Sentry/github-test#13'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Jira'})).toBeInTheDocument();
  });
});
