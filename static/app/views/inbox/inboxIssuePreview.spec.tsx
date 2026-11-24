import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {GroupStatus, ProgressState} from 'sentry/types/group';

import {InboxIssuePreview} from './inboxIssuePreview';

describe('InboxIssuePreview', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture({
    project,
    firstSeen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 60 * 1000).toISOString(),
  });
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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      body: {firstRelease: null, lastRelease: null},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sentry-app-components/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sentry-app-installations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/related/`,
      body: {data: [], investigations: [], meta: {types: []}},
    });
  });

  it('shows the issue header and overview', async () => {
    render(<InboxIssuePreview groupId={group.id} />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'RequestError'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('327,482 events')).toBeInTheDocument();
    expect(screen.getByLabelText('35,097 affected users')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Overview'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('heading', {name: 'Issue timeline'})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Add a comment'})).toBeInTheDocument();

    const sidebar = screen.getByRole('complementary', {name: 'Issue overview'});
    expect(
      within(sidebar).getByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole('button', {name: 'Modify issue priority'})
    ).toBeInTheDocument();
    expect(within(sidebar).getByRole('heading', {name: 'Last seen'})).toBeInTheDocument();
    expect(
      within(sidebar).getByRole('heading', {name: 'First seen'})
    ).toBeInTheDocument();
    expect(sidebar).toHaveTextContent(/Last seen\s*1min ago\s*First seen\s*2d ago/);
    expect(sidebar).not.toHaveTextContent('in release');
    expect(await within(sidebar).findByText('No related resources')).toBeInTheDocument();
    expect(
      await within(sidebar).findByRole('heading', {name: 'External links', level: 3})
    ).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole('button', {name: 'Collapse Section'})
    ).not.toBeInTheDocument();
  });

  it('shows the impact assessment in the sidebar', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: {
        ...group,
        derivedData: {
          hasOpenFixPr: false,
          hasRootCause: false,
          isAssigned: false,
          lastProgressedAt: null,
          progress: ProgressState.IDENTIFIED,
          status: 'open',
          viewCount: 0,
          impact: {
            level: 'super_high',
            score: 91,
            description: 'Checkout is broken for all users.',
            citations: [],
            sourceEventId: event.id,
          },
        },
      },
    });

    render(<InboxIssuePreview groupId={group.id} />, {
      organization: OrganizationFixture({features: ['seer-impact-assessment']}),
    });

    const sidebar = await screen.findByRole('complementary', {name: 'Issue overview'});
    expect(within(sidebar).getByRole('heading', {name: 'Impact'})).toBeInTheDocument();
    expect(within(sidebar).getByText('Super High (91)')).toBeInTheDocument();
    expect(within(sidebar).getByLabelText('alpha')).toBeInTheDocument();
    // Once in the header and once in the sidebar.
    expect(screen.getAllByText('Super High (91)')).toHaveLength(2);
    expect(sidebar).toHaveTextContent(/Assignee.*Impact.*Priority/);
    expect(
      within(sidebar).queryByRole('button', {name: 'Assess impact'})
    ).not.toBeInTheDocument();
  });

  it('starts an impact assessment from the sidebar', async () => {
    const assessRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/impact/assess/`,
      method: 'POST',
      body: {runId: '1'},
    });

    render(<InboxIssuePreview groupId={group.id} />, {
      organization: OrganizationFixture({features: ['seer-impact-assessment']}),
    });

    const sidebar = await screen.findByRole('complementary', {name: 'Issue overview'});
    await userEvent.click(within(sidebar).getByRole('button', {name: 'Assess impact'}));

    expect(assessRequest).toHaveBeenCalled();
    expect(await screen.findByText('Impact assessment started')).toBeInTheDocument();
  });

  it('hides impact assessments without the impact assessment feature', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: {
        ...group,
        derivedData: {
          hasOpenFixPr: false,
          hasRootCause: false,
          isAssigned: false,
          lastProgressedAt: null,
          progress: ProgressState.IDENTIFIED,
          status: 'open',
          viewCount: 0,
          impact: {
            level: 'super_high',
            score: 91,
            description: 'Checkout is broken for all users.',
            citations: [],
            sourceEventId: event.id,
          },
        },
      },
    });

    render(<InboxIssuePreview groupId={group.id} />, {organization});

    const sidebar = await screen.findByRole('complementary', {name: 'Issue overview'});
    expect(
      within(sidebar).queryByRole('heading', {name: 'Impact'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Super High (91)')).not.toBeInTheDocument();
  });

  it('pairs each timestamp with its release', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      body: {
        firstRelease: ReleaseFixture({version: '1.0.0'}),
        lastRelease: ReleaseFixture({version: '1.1.0'}),
      },
    });

    render(<InboxIssuePreview groupId={group.id} />, {organization});

    const sidebar = await screen.findByRole('complementary', {name: 'Issue overview'});
    expect(await within(sidebar).findByRole('link', {name: '1.1.0'})).toBeInTheDocument();
    expect(sidebar).toHaveTextContent(/Last seen\s*1min ago\s*in release\s*1\.1\.0/);
    expect(sidebar).toHaveTextContent(/First seen\s*2d ago\s*in release\s*1\.0\.0/);
  });

  it('links to the linked investigation and the top related issues', async () => {
    const relatedIssues = ['11', '12', '13'].map(id => ({
      issue: GroupFixture({
        id,
        shortId: `CHECKOUT-${id}`,
        title: `Checkout error ${id}`,
        metadata: {type: 'TimeoutError', value: `Checkout timed out after ${id}s`},
      }),
      relations: [{type: 'similar_stacktrace', score: 0.9432}, {type: 'same_trace'}],
    }));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/related/`,
      body: {
        data: relatedIssues,
        investigations: [
          {
            investigation: {id: '5172', title: 'Payment timeouts'},
            hypothesisStatement: 'Payment retries exhaust the connection pool',
            reason: 'Its timeouts start with the deploy.',
          },
        ],
        meta: {
          types: [
            {type: 'similar_stacktrace', status: 'ok'},
            {type: 'same_trace', status: 'ok'},
            {type: 'investigations', status: 'ok'},
          ],
        },
      },
    });

    render(<InboxIssuePreview groupId={group.id} />, {organization});

    const sidebar = await screen.findByRole('complementary', {name: 'Issue overview'});
    const investigationLink = await within(sidebar).findByRole('link', {
      name: 'Payment timeouts',
    });
    expect(investigationLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/investigations/5172/`
    );
    expect(
      within(sidebar).getByRole('link', {name: 'CHECKOUT-11 – Checkout error 11'})
    ).toHaveAttribute('href', `/organizations/${organization.slug}/issues/11/`);
    expect(
      within(sidebar).getByRole('link', {name: 'CHECKOUT-12 – Checkout error 12'})
    ).toBeInTheDocument();
    // The investigation takes one of the three rows
    expect(
      within(sidebar).queryByRole('link', {name: 'CHECKOUT-13 – Checkout error 13'})
    ).not.toBeInTheDocument();

    // Hovering a row explains why it's related
    await userEvent.hover(investigationLink);
    expect(
      await screen.findByText('Its timeouts start with the deploy.')
    ).toBeInTheDocument();
    await userEvent.hover(
      within(sidebar).getByRole('link', {name: 'CHECKOUT-11 – Checkout error 11'})
    );
    expect(
      await screen.findByText('Similar stack trace (94%) · Same trace')
    ).toBeInTheDocument();
    // Shown like the issue stream: the error type, then the message
    expect(screen.getByText('TimeoutError')).toBeInTheDocument();
    expect(screen.getByText('Checkout timed out after 11s')).toBeInTheDocument();
  });

  it('shows an error when every related issue type that applies failed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/related/`,
      body: {
        data: [],
        investigations: [],
        meta: {
          types: [
            {type: 'similar_stacktrace', status: 'unavailable'},
            {type: 'same_trace', status: 'unavailable'},
            {type: 'contributing', status: 'not_applicable'},
            {type: 'investigations', status: 'ok'},
          ],
        },
      },
    });

    render(<InboxIssuePreview groupId={group.id} />, {organization});

    const sidebar = await screen.findByRole('complementary', {name: 'Issue overview'});
    expect(
      await within(sidebar).findByText('Unable to load related resources')
    ).toBeInTheDocument();
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
