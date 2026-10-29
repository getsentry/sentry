import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {GroupStatus} from 'sentry/types/group';
import {InboxIssuePreview} from 'sentry/views/inbox/inboxIssuePreview';

describe('InboxIssuePreview', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture({project});
  const event = EventFixture({id: 'event-id', projectID: project.id});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: event,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rules: []},
    });
  });

  it('shows the issue header and activity', async () => {
    render(<InboxIssuePreview groupId={group.id} />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'RequestError'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('327,482 events')).toBeInTheDocument();
    expect(screen.getByLabelText('35,097 affected users')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Modify issue priority'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('combobox', {name: 'Add a comment'})).toBeInTheDocument();
  });

  it('resolves the issue from the header actions', async () => {
    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {status: GroupStatus.RESOLVED},
    });

    render(<InboxIssuePreview groupId={group.id} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

    expect(updateRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        query: {id: [group.id]},
        data: expect.objectContaining({status: GroupStatus.RESOLVED}),
      })
    );
  });

  function mockTelemetryResponses() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [], meta: {fields: {}, units: {}}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/flags/logs/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/actionable-items/`,
      body: {errors: []},
    });
  }

  it('shows the event filters, graph, and details in the telemetry tab', async () => {
    mockTelemetryResponses();

    render(<InboxIssuePreview groupId={group.id} />, {organization});

    await userEvent.click(await screen.findByRole('tab', {name: 'Telemetry'}));

    expect(await screen.findByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter events\u2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Close sidebar'})).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Copy Event ID'})
    ).toBeInTheDocument();
  });
});
