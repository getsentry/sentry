import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  mountWithTheme as rtlMountWithTheme,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';

describe('getIssueFieldRenderer', function () {
  let location, context, project, organization, data, user;

  beforeEach(function () {
    context = initializeOrg({
      project: TestStubs.Project(),
    });
    organization = context.organization;
    project = context.project;
    act(() => ProjectsStore.loadInitialData([project]));
    user = 'email:text@example.com';

    location = {
      pathname: '/events',
      query: {},
    };
    data = {
      id: '1',
      team_key_transaction: 1,
      title: 'ValueError: something bad',
      transaction: 'api.do_things',
      boolValue: 1,
      numeric: 1.23,
      createdAt: new Date(2019, 9, 3, 12, 13, 14),
      url: '/example',
      project: project.slug,
      release: 'F2520C43515BD1F0E8A6BD46233324641A370BF6',
      user,
      'span_ops_breakdown.relative': '',
      'spans.browser': 10,
      'spans.db': 30,
      'spans.http': 15,
      'spans.resource': 20,
      'spans.total.time': 75,
      'transaction.duration': 75,
      'timestamp.to_day': '2021-09-05T00:00:00+00:00',
      lifetimeCount: 10000,
      filteredCount: 3000,
      count: 6000,
      selectionDateString: 'last 7 days',
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.slug}/`,
      body: project,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/key-transactions/`,
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/key-transactions/`,
      method: 'DELETE',
    });
  });

  describe('Issue fields', () => {
    it('can render assignee', async function () {
      MemberListStore.loadInitialData([
        {
          id: '1',
          name: 'Test User',
          email: 'test@sentry.io',
          avatar: {
            avatarType: 'letter_avatar',
            avatarUuid: null,
          },
        },
      ]);

      const group = TestStubs.Group({project});
      GroupStore.add([
        {
          ...group,
          owners: [{owner: 'user:1', type: 'suspectCommit'}],
          assignedTo: {
            email: 'test@sentry.io',
            type: 'user',
            id: '1',
            name: 'Test User',
          },
        },
      ]);
      const renderer = getIssueFieldRenderer('assignee', {
        assignee: 'string',
      });

      rtlMountWithTheme(
        renderer(data, {
          location,
          organization,
        })
      );
      expect(screen.getByText('TU')).toBeInTheDocument();
      userEvent.hover(screen.getByText('TU'));
      expect(await screen.findByText('Assigned to')).toBeInTheDocument();
      expect(await screen.findByText('Test User')).toBeInTheDocument();
      expect(await screen.findByText('Based on')).toBeInTheDocument();
      expect(await screen.findByText('commit data')).toBeInTheDocument();
    });

    it('can render counts', async function () {
      const renderer = getIssueFieldRenderer('count', {
        count: 'string',
      });

      rtlMountWithTheme(
        renderer(data, {
          location,
          organization,
        })
      );
      expect(screen.getByText('3k')).toBeInTheDocument();
      expect(screen.getByText('6k')).toBeInTheDocument();
      userEvent.hover(screen.getByText('3k'));
      expect(await screen.findByText('Total in last 7 days')).toBeInTheDocument();
      expect(screen.getByText('Matching search filters')).toBeInTheDocument();
      expect(screen.getByText('Since issue began')).toBeInTheDocument();
    });
  });
});
