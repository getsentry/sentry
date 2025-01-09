import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import GroupUserFeedback from './groupUserFeedback';

describe('GroupUserFeedback', () => {
  const group = GroupFixture();
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const router = RouterFixture({
    params: {groupId: group.id},
  });

  beforeEach(() => {
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
  });

  it('renders empty state', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/user-reports/`,
      body: [],
    });

    render(<GroupUserFeedback />, {organization, router});
    expect(
      await screen.findByRole('heading', {
        name: 'What do users think?',
      })
    ).toBeInTheDocument();
  });

  it('renders user feedback', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/user-reports/`,
      body: [
        {
          id: '1111',
          eventID: 'abc',
          name: 'Test User',
          email: 'test@example.com',
          comments: 'custom comment',
          dateCreated: '2024-10-24T01:22:30',
          user: {
            id: 'something',
            username: null,
            email: null,
            name: null,
            ipAddress: '127.0.0.1',
            avatarUrl: null,
          },
          event: {
            id: '123',
            eventID: 'abc',
          },
        },
      ],
    });

    render(<GroupUserFeedback />, {organization, router});
    expect(await screen.findByText('Test User')).toBeInTheDocument();
    expect(await screen.findByText('custom comment')).toBeInTheDocument();
  });
});
