import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventDetails} from 'sentry/views/issueDetails/streamline/eventDetails';
import {MOCK_EVENTS_TABLE_DATA} from 'sentry/views/performance/transactionSummary/transactionEvents/testUtils';

jest.mock('sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent');
jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

describe('EventDetails', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture();
  const event = EventFixture({id: 'event-id'});
  const defaultProps = {project, group, event};

  let mockActionableItems: jest.Mock;
  let mockList: jest.Mock;
  let mockListMeta: jest.Mock;

  beforeEach(function () {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set(['environments'])
    );
    ProjectsStore.loadInitialData([project]);
    MockApiClient.clearMockResponses();
    mockActionableItems = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/actionable-items/`,
      body: {errors: []},
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
    mockList = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",` +
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"`,
      },
      body: {
        data: MOCK_EVENTS_TABLE_DATA,
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });

    mockListMeta = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",` +
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"`,
      },
      body: {
        data: [{'count()': 100}],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('count()');
        },
      ],
    });
  });

  it('displays all basic components', async function () {
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    // Navigation
    expect(screen.getByRole('tab', {name: 'Recommended Event'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'First Event'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Event'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View All Events'})).toBeInTheDocument();
    // Content
    expect(mockActionableItems).toHaveBeenCalled();
    // All Events (should not query initially)
    expect(mockList).not.toHaveBeenCalled();
    expect(mockListMeta).not.toHaveBeenCalled();
  });

  it('should display the events list', async function () {
    const router = RouterFixture({
      location: LocationFixture({
        pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
      }),
      routes: [{name: '', path: 'events/'}],
    });
    render(<EventDetails {...defaultProps} />, {organization, router});

    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(screen.getByText('All Events')).toBeInTheDocument();

    expect(mockList).toHaveBeenCalled();
    expect(mockListMeta).toHaveBeenCalled();
  });
});
