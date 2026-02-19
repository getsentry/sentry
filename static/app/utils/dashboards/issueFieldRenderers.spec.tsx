import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';

describe('getIssueFieldRenderer', () => {
  let location: any,
    context: any,
    project: any,
    organization: any,
    theme: any,
    data: any,
    user: any;

  beforeEach(() => {
    context = initializeOrg({
      organization,
      projects: [ProjectFixture()],
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
      lifetimeEvents: 10000,
      filteredEvents: 3000,
      events: 6000,
      period: '7d',
      links: [{url: 'sentry.io', displayName: 'ANNO-123'}],
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
    it('can render assignee', async () => {
      MemberListStore.loadInitialData([
        UserFixture({
          name: 'Test User',
          email: 'test@sentry.io',
          avatar: {
            avatarType: 'letter_avatar',
            avatarUuid: null,
          },
        }),
      ]);

      const group = GroupFixture({
        project,
        assignedTo: {
          email: 'test@sentry.io',
          type: 'user',
          id: '1',
          name: 'Test User',
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/`,
        body: group,
      });
      const renderer = getIssueFieldRenderer('assignee', {});

      render(
        renderer(data, {
          location,
          organization,
          theme,
        }) as React.ReactElement
      );
      await userEvent.hover(await screen.findByText('TU'));
      expect(await screen.findByText('Assigned to Test User')).toBeInTheDocument();
    });

    it('updates assignee when changed', async () => {
      MemberListStore.loadInitialData([
        UserFixture({
          id: '1',
          name: 'Test User',
          email: 'test@sentry.io',
        }),
        UserFixture({
          id: '2',
          name: 'Next User',
          email: 'next@sentry.io',
        }),
      ]);

      const group = GroupFixture({
        id: data.id,
        project,
        assignedTo: {
          email: 'test@sentry.io',
          type: 'user',
          id: '1',
          name: 'Test User',
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/`,
        body: group,
      });

      const assignMock = MockApiClient.addMockResponse({
        method: 'PUT',
        url: `/organizations/${organization.slug}/issues/${group.id}/`,
        body: {
          ...group,
          assignedTo: {
            email: 'next@sentry.io',
            type: 'user',
            id: '2',
            name: 'Next User',
          },
        },
      });

      const renderer = getIssueFieldRenderer('assignee', {});

      render(
        renderer(data, {
          location,
          organization,
          theme,
        }) as React.ReactElement
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Modify issue assignee'})
      );
      await userEvent.click(await screen.findByText('Next User'));

      await waitFor(() =>
        expect(assignMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/issues/${group.id}/`,
          expect.objectContaining({
            data: {assignedTo: 'user:2', assignedBy: 'assignee_selector'},
          })
        )
      );

      await userEvent.hover(await screen.findByText('NU'));
      expect(await screen.findByText('Assigned to Next User')).toBeInTheDocument();
    });

    it('can render counts', async () => {
      const renderer = getIssueFieldRenderer('events', {});

      render(
        renderer(data, {
          location,
          organization,
          theme,
        }) as React.ReactElement
      );
      expect(screen.getByText('3K')).toBeInTheDocument();
      expect(screen.getByText('6K')).toBeInTheDocument();
      await userEvent.hover(screen.getByText('3K'));
      expect(await screen.findByText('Total in last 7 days')).toBeInTheDocument();
      expect(screen.getByText('Matching search filters')).toBeInTheDocument();
      expect(screen.getByText('Since issue began')).toBeInTheDocument();
    });
  });

  it('can render links', () => {
    const renderer = getIssueFieldRenderer('links', {});

    render(
      renderer(data, {
        location,
        organization,
        theme,
      }) as React.ReactElement
    );
    expect(screen.getByText('ANNO-123')).toBeInTheDocument();
  });

  it('can render multiple links', () => {
    const renderer = getIssueFieldRenderer('links', {});

    render(
      renderer(
        {
          data,
          ...{
            links: [
              {url: 'sentry.io', displayName: 'ANNO-123'},
              {url: 'sentry.io', displayName: 'ANNO-456'},
            ],
          },
        },
        {
          location,
          organization,
          theme,
        }
      ) as React.ReactElement
    );
    expect(screen.getByText('ANNO-123')).toBeInTheDocument();
    expect(screen.getByText('ANNO-456')).toBeInTheDocument();
  });
});
