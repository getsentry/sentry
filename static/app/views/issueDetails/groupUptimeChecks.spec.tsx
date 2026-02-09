import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UptimeCheckFixture} from 'sentry-fixture/uptimeCheck';

import {render, screen, type RouterConfig} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {getShortEventId} from 'sentry/utils/events';
import {statusToText} from 'sentry/views/insights/uptime/timelineConfig';
import GroupUptimeChecks from 'sentry/views/issueDetails/groupUptimeChecks';

describe('GroupUptimeChecks', () => {
  const detectorId = '123';
  const event = EventFixture({
    occurrence: {
      evidenceData: {detectorId},
    },
  });
  const group = GroupFixture({
    issueCategory: IssueCategory.UPTIME,
    issueType: IssueType.UPTIME_DOMAIN_FAILURE,
  });
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/${group.id}/uptime-checks/`,
    },
    route: `/organizations/:orgId/issues/:groupId/uptime-checks/`,
  };

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
      url: `/organizations/${organization.slug}/detectors/123/`,
      body: UptimeDetectorFixture({id: '123'}),
    });
    PageFiltersStore.onInitializeUrlState({
      projects: [Number(project.id)],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
  });

  it('renders the empty uptime check table', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${detectorId}/checks/`,
      body: [],
    });

    render(<GroupUptimeChecks />, {
      organization,
      initialRouterConfig,
    });
    expect(await screen.findByText('All Uptime Checks')).toBeInTheDocument();
    for (const column of ['Timestamp', 'Status', 'Duration', 'Trace', 'Region']) {
      expect(screen.getByText(column)).toBeInTheDocument();
    }
    expect(screen.getByText('No matching uptime checks found')).toBeInTheDocument();
  });

  it('renders the uptime check table with data', async () => {
    const uptimeCheck = UptimeCheckFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${detectorId}/checks/`,
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

    render(<GroupUptimeChecks />, {
      organization,
      initialRouterConfig,
    });
    expect(await screen.findByText('All Uptime Checks')).toBeInTheDocument();
    expect(screen.queryByText('No matching uptime checks found')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 matching uptime checks')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous Page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Page'})).toBeInTheDocument();

    expect(screen.getByRole('time')).toHaveTextContent(/Jan 1, 2025/);
    expect(screen.getByText(statusToText[uptimeCheck.checkStatus])).toBeInTheDocument();
    expect(screen.getByText(`${uptimeCheck.durationMs}ms`)).toBeInTheDocument();
    expect(screen.getByText(getShortEventId(uptimeCheck.traceId))).toBeInTheDocument();
    expect(
      screen.getByText(getShortEventId(uptimeCheck.traceItemId))
    ).toBeInTheDocument();
    expect(screen.getByText(uptimeCheck.regionName)).toBeInTheDocument();

    // Span counts also need to load (includes 7 system spans)
    expect(await screen.findByText('7 spans')).toBeInTheDocument();
  });

  it('indicates when there are spans in a trace', async () => {
    const uptimeCheck = UptimeCheckFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${detectorId}/checks/`,
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

    render(<GroupUptimeChecks />, {
      organization,
      initialRouterConfig,
    });
    expect(await screen.findByText('All Uptime Checks')).toBeInTheDocument();

    const traceId = getShortEventId(uptimeCheck.traceId);
    const traceItemId = getShortEventId(uptimeCheck.traceItemId);

    // 10 user spans + 7 system spans = 17 total
    expect(await screen.findByText('17 spans')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: traceId})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: traceItemId})).toBeInTheDocument();
  });
});
