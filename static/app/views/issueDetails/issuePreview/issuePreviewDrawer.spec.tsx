import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {IssueCategory} from 'sentry/types/group';
import {IssuePreviewDrawer} from 'sentry/views/issueDetails/issuePreview/issuePreviewDrawer';

describe('IssuePreviewDrawer', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/replay-count/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/attachments/',
      body: [],
    });
  });

  it('renders the issue short ID and title', async () => {
    const project = ProjectFixture();
    const group = GroupFixture({
      id: '123',
      shortId: 'JAVASCRIPT-6QS',
      project,
      metadata: {type: 'RequestError', title: 'ReferenceError: foo is not defined'},
    });

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });

    render(<IssuePreviewDrawer groupId={group.id} />);

    expect(await screen.findByText('JAVASCRIPT-6QS')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'ReferenceError: foo is not defined'})
    ).toBeInTheDocument();
  });

  it('builds badge links from the group context, not the route param', async () => {
    const project = ProjectFixture();
    const group = GroupFixture({id: '123', shortId: 'JAVASCRIPT-6QS', project});

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/attachments/`,
      body: [
        {
          id: '1',
          name: 'screenshot.png',
          headers: {'Content-Type': 'image/png'},
          mimetype: 'image/png',
          size: 100,
          sha1: 'abc',
          dateCreated: '2024-01-01T00:00:00Z',
          type: 'event.attachment',
          event_id: 'abc123',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });

    render(<IssuePreviewDrawer groupId={group.id} />);

    const attachmentsLink = await screen.findByRole('button', {
      name: "View this issue's attachments",
    });
    expect(attachmentsLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/attachments/'
    );
  });

  it('resolves the issue', async () => {
    const organization = OrganizationFixture({id: '4660', slug: 'org'});
    const project = ProjectFixture({
      id: '2448',
      name: 'project name',
      slug: 'project',
      teams: [TeamFixture({id: '3', slug: 'frontend', name: 'Frontend'})],
    });
    const group = GroupFixture({
      id: '1337',
      issueCategory: IssueCategory.ERROR,
      project,
    });

    ConfigStore.init();
    ConfigStore.set('user', UserFixture());
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        billing: null,
        integration: {ok: false, reason: null},
        seerReposLinked: false,
        githubWriteIntegration: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    render(<IssuePreviewDrawer groupId={group.id} />, {organization});

    const resolveButton = await screen.findByRole('button', {name: 'Resolve'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: {...group, status: 'resolved'},
    });

    await userEvent.click(resolveButton);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/issues/`,
        expect.objectContaining({
          data: {status: 'resolved', statusDetails: {}, substatus: null},
        })
      );
    });

    expect(await screen.findAllByText('Resolved')).not.toHaveLength(0);
  });

  it('does not show the Autofix tab when AI features are unavailable', async () => {
    const project = ProjectFixture();
    const group = GroupFixture({id: '123', shortId: 'JAVASCRIPT-6QS', project});

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });

    render(<IssuePreviewDrawer groupId={group.id} />);

    expect(await screen.findByRole('tab', {name: 'Activity'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Autofix'})).not.toBeInTheDocument();
  });

  it('opens the Details tab and renders the event content', async () => {
    const project = ProjectFixture();
    const group = GroupFixture({id: '123', shortId: 'JAVASCRIPT-6QS', project});
    const event = EventFixture({
      id: 'event-1',
      entries: [
        {
          type: 'message',
          data: {formatted: 'ReferenceError: foo is not defined'},
        },
      ],
    });

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });
    const eventRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/events/recommended/`,
      body: event,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/${event.id}/committers/`,
      body: {committers: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rules: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/${event.id}/actionable-items/`,
      body: {errors: []},
    });

    render(<IssuePreviewDrawer groupId={group.id} />);

    await userEvent.click(await screen.findByRole('tab', {name: 'Details'}));

    await waitFor(() => expect(eventRequest).toHaveBeenCalled());

    expect(
      await screen.findByText('ReferenceError: foo is not defined')
    ).toBeInTheDocument();
  });

  it('opens the Autofix tab and shows the start state', async () => {
    const organization = OrganizationFixture({features: ['gen-ai-features']});
    const project = ProjectFixture();
    const group = GroupFixture({id: '123', shortId: 'JAVASCRIPT-6QS', project});

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: true, reason: null},
        billing: {hasAutofixQuota: true},
        seerReposLinked: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/`,
      body: {autofix: null},
    });

    render(<IssuePreviewDrawer groupId={group.id} />, {organization});

    await userEvent.click(await screen.findByRole('tab', {name: 'Autofix'}));

    expect(
      await screen.findByRole('button', {name: 'Start Analysis'})
    ).toBeInTheDocument();
  });
});
