import selectEvent from 'react-select-event';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {DiscoverLanding} from 'sentry/views/discover/landing';

describe('Discover > Landing', function () {
  const eventTitle = 'Oh no something bad';
  const features = ['discover-basic', 'discover-query'];

  beforeEach(function () {
    ProjectsStore.loadInitialData([ProjectFixture()]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          id: 'string',
          title: 'string',
          'project.name': 'string',
          timestamp: 'date',
          'user.id': 'string',
        },
        data: [
          {
            id: 'deadbeef',
            'user.id': 'alberto leal',
            title: eventTitle,
            'project.name': 'project-slug',
            timestamp: '2019-05-23T22:12:48+00:00',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/project-slug:deadbeef/',
      method: 'GET',
      body: {
        id: '1234',
        size: 1200,
        eventID: 'deadbeef',
        title: 'Oh no something bad',
        message: 'It was not good',
        dateCreated: '2019-05-23T22:12:48+00:00',
        entries: [
          {
            type: 'message',
            message: 'bad stuff',
            data: {},
          },
        ],
        tags: [{key: 'browser', value: 'Firefox'}],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/',
      method: 'GET',
      body: [],
    });
  });

  it('denies access on missing feature', function () {
    render(
      <DiscoverLanding organization={Organization()} {...RouteComponentPropsFixture()} />
    );

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('has the right sorts', function () {
    const org = Organization({features});

    render(<DiscoverLanding organization={org} {...RouteComponentPropsFixture()} />);

    const expectedSorts = [
      'My Queries',
      'Recently Edited',
      'Query Name (A-Z)',
      'Date Created (Newest)',
      'Date Created (Oldest)',
      'Most Outdated',
      'Most Popular',
      'Recently Viewed',
    ];

    // Open menu
    selectEvent.openMenu(screen.getByRole('button', {name: 'Sort By My Queries'}));

    // Check that all sorts are there
    expectedSorts.forEach(sort =>
      expect(screen.getAllByText(sort)[0]).toBeInTheDocument()
    );
  });

  it('links back to the homepage', () => {
    const org = Organization({features});

    render(<DiscoverLanding organization={org} {...RouteComponentPropsFixture()} />, {
      context: RouterContextFixture(),
    });

    expect(screen.getByText('Discover')).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/homepage/'
    );
  });
});
