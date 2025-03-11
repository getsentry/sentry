import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {UptimeCheckFixture} from 'sentry-fixture/uptimeCheck';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {getShortEventId} from 'sentry/utils/events';
import {statusToText} from 'sentry/views/insights/uptime/timelineConfig';
import GroupUptimeChecks from 'sentry/views/issueDetails/groupUptimeChecks';

describe('GroupUptimeChecks', () => {
  const uptimeRuleId = '123';
  const event = EventFixture({
    tags: [
      {
        key: 'uptime_rule',
        value: uptimeRuleId,
      },
    ],
  });
  const group = GroupFixture({
    issueCategory: IssueCategory.UPTIME,
    issueType: IssueType.UPTIME_DOMAIN_FAILURE,
  });
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const router = RouterFixture({
    params: {groupId: group.id},
  });

  beforeEach(() => {
    GroupStore.init();
    GroupStore.add([group]);
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: event,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/uptime/123/`,
      body: UptimeRuleFixture(),
    });
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [Number(project.id)],
        environments: [],
        datetime: {period: '24h', start: null, end: null, utc: null},
      },
      new Set()
    );
  });

  it('renders the empty uptime check table', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeRuleId}/checks/`,
      body: [],
    });

    render(<GroupUptimeChecks />, {organization, router});
    expect(await screen.findByText('All Uptime Checks')).toBeInTheDocument();
    for (const column of ['Timestamp', 'Status', 'Duration', 'Trace', 'Region']) {
      expect(screen.getByText(column)).toBeInTheDocument();
    }
    expect(screen.getByText('No matching uptime checks found')).toBeInTheDocument();
  });

  it('renders the uptime check table with data', async () => {
    const uptimeCheck = UptimeCheckFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeRuleId}/checks/`,
      body: [uptimeCheck],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
      },
      match: [MockApiClient.matchQuery({referrer: 'api.uptime-checks-grid'})],
    });

    render(<GroupUptimeChecks />, {organization, router});
    expect(await screen.findByText('All Uptime Checks')).toBeInTheDocument();
    expect(screen.queryByText('No matching uptime checks found')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 matching uptime checks')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous Page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Page'})).toBeInTheDocument();

    expect(screen.getByRole('time')).toHaveTextContent(/Jan 1, 2025/);
    expect(screen.getByText(statusToText[uptimeCheck.checkStatus])).toBeInTheDocument();
    expect(screen.getByText(`${uptimeCheck.durationMs}ms`)).toBeInTheDocument();
    expect(screen.getByText(getShortEventId(uptimeCheck.traceId))).toBeInTheDocument();
    expect(screen.getByText(uptimeCheck.regionName)).toBeInTheDocument();

    // Span counts also need to load
    expect(await screen.findByText('0 spans')).toBeInTheDocument();
  });

  it('indicates when there are spans in a trace', async () => {
    const uptimeCheck = UptimeCheckFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeRuleId}/checks/`,
      body: [uptimeCheck],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [{trace: uptimeCheck.traceId, 'count()': 10}],
      },
      match: [MockApiClient.matchQuery({referrer: 'api.uptime-checks-grid'})],
    });

    render(<GroupUptimeChecks />, {organization, router});
    expect(await screen.findByText('All Uptime Checks')).toBeInTheDocument();

    const traceId = getShortEventId(uptimeCheck.traceId);

    // TraceID is a not link until we know there are spans
    expect(screen.getByText(traceId)).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: traceId})).not.toBeInTheDocument();

    // Once the span count has loaded it will be a link
    expect(await screen.findByText('10 spans')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: traceId})).toBeInTheDocument();
  });
});
