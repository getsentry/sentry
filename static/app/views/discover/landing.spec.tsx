import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import DiscoverLanding from 'sentry/views/discover/landing';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('Discover > Landing', () => {
  const eventTitle = 'Oh no something bad';
  const features = ['discover-basic', 'discover-query'];

  beforeEach(() => {
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

  it('denies access on missing feature', () => {
    render(<DiscoverLanding />);

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('has the right sorts', async () => {
    const org = OrganizationFixture({features});

    render(
      <OrganizationContext value={org}>
        <DiscoverLanding />
      </OrganizationContext>
    );

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
    await selectEvent.openMenu(screen.getByRole('button', {name: 'Sort By My Queries'}));

    // Check that all sorts are there
    expectedSorts.forEach(sort =>
      expect(screen.getAllByText(sort)[0]).toBeInTheDocument()
    );
  });

  it('links back to the homepage', async () => {
    const org = OrganizationFixture({features});

    render(
      <OrganizationContext value={org}>
        <DiscoverLanding />
      </OrganizationContext>
    );

    expect(await screen.findByRole('link', {name: 'Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/discover/homepage/'
    );
  });
});
