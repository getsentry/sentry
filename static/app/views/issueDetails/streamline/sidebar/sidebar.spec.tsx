import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {GroupActivityType} from 'sentry/types/group';
import StreamlinedSidebar from 'sentry/views/issueDetails/streamline/sidebar/sidebar';

describe('StreamlinedSidebar', function () {
  const user = UserFixture();
  user.options.prefersIssueDetailsStreamlinedUI = true;
  ConfigStore.set('user', user);

  const activityContent = 'test-note';
  const issueTrackingKey = 'issue-key';

  const organization = OrganizationFixture({
    features: ['gen-ai-features'],
  });
  const project = ProjectFixture();
  const group = GroupFixture({
    activity: [
      {
        type: GroupActivityType.NOTE,
        id: 'note-1',
        data: {text: activityContent},
        dateCreated: '2020-01-01T00:00:00',
        user,
        project,
      },
    ],
  });
  const event = EventFixture({group});

  let mockFirstLastRelease: jest.Mock;
  let mockExternalIssues: jest.Mock;

  beforeEach(function () {
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: group,
    });

    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: false},
        integration: {ok: true},
        githubWriteIntegration: {ok: true},
      },
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: {
        steps: [],
      },
    });

    mockFirstLastRelease = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/external-issues/`,
      body: [],
    });

    mockExternalIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [
        GitHubIntegrationFixture({
          status: 'active',
          externalIssues: [
            {
              id: '321',
              key: issueTrackingKey,
              url: 'https://github.com/Test-Sentry/github-test/issues/13',
              title: 'SyntaxError: XYZ',
              description: 'something else, sorry',
              displayName: '',
            },
          ],
        }),
      ],
    });
  });

  it('renders all the sections as expected', async function () {
    render(<StreamlinedSidebar group={group} project={project} event={event} />, {
      organization,
    });

    expect(await screen.findByText('Solutions Hub')).toBeInTheDocument();

    expect(await screen.findByText('First seen')).toBeInTheDocument();
    expect(screen.getByText('Last seen')).toBeInTheDocument();
    expect(mockFirstLastRelease).toHaveBeenCalled();

    expect(await screen.findByText('Issue Tracking')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: issueTrackingKey})
    ).toBeInTheDocument();
    expect(mockExternalIssues).toHaveBeenCalled();

    expect(screen.getByRole('heading', {name: 'Activity'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /Add a comment/})).toBeInTheDocument();
    expect(screen.getByText(activityContent)).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: 'Similar Issues'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Similar Issues'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Merged Issues'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Merged Issues'})).toBeInTheDocument();
  });
});
