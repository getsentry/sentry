import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import Results from 'app/views/eventsV2/results';

const FIELDS = [
  {
    field: 'title',
  },
  {
    field: 'timestamp',
  },
  {
    field: 'user',
  },
  {
    field: 'count()',
  },
];

const generateFields = () => ({
  field: FIELDS.map(i => i.field),
});

describe('EventsV2 > Results', function() {
  const eventTitle = 'Oh no something bad';
  const features = ['discover-basic'];
  let eventResultsMock;

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    eventResultsMock = MockApiClient.addMockResponse({
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
      url: '/organizations/org-slug/events-meta/',
      body: {
        count: 2,
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
      url: '/organizations/org-slug/events-facets/',
      body: [
        {
          key: 'release',
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'environment',
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
      ],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('loads data when moving from an invalid to valid EventView', function() {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {}},
      },
    });

    const wrapper = mountWithTheme(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );
    // No request as eventview was invalid.
    expect(eventResultsMock).not.toHaveBeenCalled();

    // Should redirect.
    expect(browserHistory.replace).toHaveBeenCalled();

    // Update location simulating a redirect.
    wrapper.setProps({location: {query: {...generateFields()}}});
    wrapper.update();

    // Should load events once
    expect(eventResultsMock).toHaveBeenCalled();
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
      <Results
        organization={organization}
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

  it('renders a y-axis selector', function() {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), yAxis: 'count()'}},
      },
    });

    const wrapper = mountWithTheme(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );
    // y-axis selector is last.
    const selector = wrapper.find('OptionSelector').last();

    // Open the selector
    selector.find('StyledDropdownButton button').simulate('click');

    // Click one of the options.
    selector
      .find('DropdownMenu MenuItem span')
      .first()
      .simulate('click');
    wrapper.update();

    const eventsRequest = wrapper.find('EventsChart');
    expect(eventsRequest.props().yAxis).toEqual('count()');
  });

  it('renders a display selector', function() {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), display: 'previoux'}},
      },
    });

    const wrapper = mountWithTheme(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );
    // display selector is first.
    const selector = wrapper.find('OptionSelector').first();

    // Open the selector
    selector.find('StyledDropdownButton button').simulate('click');

    // Click the 'none' option.
    selector
      .find('DropdownMenu MenuItem span')
      .first()
      .simulate('click');
    wrapper.update();

    const eventsRequest = wrapper.find('EventsChart').props();
    expect(eventsRequest.disableReleases).toEqual(true);
    expect(eventsRequest.disablePrevious).toEqual(true);
  });
});
