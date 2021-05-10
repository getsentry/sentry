import {mountWithTheme} from 'sentry-test/enzyme';

import {DiscoverLanding} from 'app/views/eventsV2/landing';

describe('EventsV2 > Landing', function () {
  const eventTitle = 'Oh no something bad';
  const features = ['discover-basic', 'discover-query'];

  beforeEach(function () {
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
      url: '/organizations/org-slug/discover/saved/',
      method: 'GET',
      body: [],
    });
  });

  it('handles no projects', function () {
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization({features})}
        location={{query: {}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('SentryDocumentTitle');
    expect(content.text()).toContain('You need at least one project to use this view');
  });

  it('denies access on missing feature', function () {
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization()}
        location={{query: {}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('PageContent');
    expect(content.text()).toContain("You don't have access to this feature");
  });
});
