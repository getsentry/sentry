import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {DiscoverLanding} from 'app/views/eventsV2/landing';

const FIELDS = [
  {
    field: 'title',
    title: 'Custom Title',
  },
  {
    field: 'timestamp',
    title: 'Custom Time',
  },
  {
    field: 'user',
    title: 'Custom User',
  },
];

const generateFields = () => {
  return {
    fieldnames: FIELDS.map(i => i.title),
    field: FIELDS.map(i => i.field),
  };
};

describe('EventsV2', function() {
  const eventTitle = 'Oh no something bad';
  const features = ['events-v2'];

  beforeEach(function() {
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

  it('handles no projects', function() {
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization({features})}
        location={{query: {...generateFields()}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('SentryDocumentTitle');
    expect(content.text()).toContain('You need at least one project to use this view');
  });

  it('pagination cursor should be cleared when making a search', function() {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), cursor: '0%3A50%3A0'}},
      },
    });

    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={organization}
        params={{orgId: organization.slug}}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );

    // ensure cursor query string is initially present in the location

    expect(initialData.router.location).toEqual({
      query: {
        ...generateFields(),
        cursor: '0%3A50%3A0',
      },
    });

    // perform a search

    const search = wrapper.find('#smart-search-input').first();

    search.simulate('change', {target: {value: 'geo:canada'}}).simulate('submit', {
      preventDefault() {},
    });

    // cursor query string should be omitted from the query string

    expect(initialData.router.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        ...generateFields(),
        query: 'geo:canada',
        statsPeriod: '14d',
      },
    });
  });
});
