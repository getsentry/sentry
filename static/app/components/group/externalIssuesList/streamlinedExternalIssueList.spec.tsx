import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PlatformExternalIssueFixture} from 'sentry-fixture/platformExternalIssue';
import {ProjectFixture} from 'sentry-fixture/project';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';

import {StreamlinedExternalIssueList} from './streamlinedExternalIssueList';

describe('StreamlinedExternalIssueList', () => {
  const organization = OrganizationFixture();
  const event = EventFixture();
  const group = GroupFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SentryAppComponentsStore.init();
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

    render(
      <StreamlinedExternalIssueList event={event} group={group} project={project} />
    );

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
      url: `/issues/1/external-issues/1/`,
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

    render(
      <StreamlinedExternalIssueList event={event} group={group} project={project} />
    );

    expect(
      await screen.findByRole('button', {name: 'Clickup Issue'})
    ).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', {name: 'Clickup Issue'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Unlink issue'}));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {name: 'Clickup Issue'})
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

    render(
      <StreamlinedExternalIssueList event={event} group={group} project={project} />
    );

    expect(await screen.findByRole('button', {name: 'GitHub'})).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'GitHub'}));

    // Both items are listed inside the dropdown
    expect(
      await screen.findByRole('menuitemradio', {name: 'GitHub sentry'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'GitHub codecov'})
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

    render(
      <StreamlinedExternalIssueList event={event} group={group} project={project} />
    );

    expect(
      await screen.findByText('Track this issue in Jira, GitHub, etc.')
    ).toBeInTheDocument();
  });
});
