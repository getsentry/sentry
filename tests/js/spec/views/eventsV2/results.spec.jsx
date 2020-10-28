import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
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

describe('EventsV2 > Results', function () {
  const eventTitle = 'Oh no something bad';
  const features = ['discover-basic'];
  let eventResultsMock;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects-count/',
      body: {myProjects: 10, allProjects: 300},
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
      url: '/organizations/org-slug/releases/stats/',
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

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('loads data when moving from an invalid to valid EventView', async function () {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
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

    ProjectsStore.loadInitialData(initialData.organization.projects);
    await tick();
    wrapper.update();
    // No request as eventview was invalid.
    expect(eventResultsMock).not.toHaveBeenCalled();

    // Should redirect and retain the old query value..
    expect(browserHistory.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          query: 'tag:value',
        }),
      })
    );

    // Update location simulating a redirect.
    wrapper.setProps({location: {query: {...generateFields()}}});
    wrapper.update();

    // Should load events once
    expect(eventResultsMock).toHaveBeenCalled();
  });

  it('pagination cursor should be cleared when making a search', async function () {
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

    ProjectsStore.loadInitialData(initialData.organization.projects);

    const wrapper = mountWithTheme(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );

    await tick();
    wrapper.update();

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

  it('renders a y-axis selector', function () {
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
    selector.find('DropdownMenu MenuItem span').first().simulate('click');
    wrapper.update();

    const eventsRequest = wrapper.find('EventsChart');
    expect(eventsRequest.props().yAxis).toEqual('count()');
  });

  it('renders a display selector', function () {
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

    // Click the 'default' option.
    selector
      .find('DropdownMenu MenuItem [data-test-id="option-default"]')
      .first()
      .simulate('click');
    wrapper.update();

    const eventsRequest = wrapper.find('EventsChart').props();
    expect(eventsRequest.disableReleases).toEqual(false);
    expect(eventsRequest.disablePrevious).toEqual(true);
  });

  it('excludes top5 options when plan does not include discover-query', function () {
    const organization = TestStubs.Organization({
      features: ['discover-basic'],
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

    // Make sure the top5 option isn't present
    const options = selector
      .find('DropdownMenu MenuItem')
      .map(item => item.prop('data-test-id'));
    expect(options).not.toContain('option-top5');
    expect(options).not.toContain('option-dailytop5');
    expect(options).toContain('option-default');
  });

  it('needs confirmation on long queries', async function () {
    const organization = TestStubs.Organization({
      features: ['discover-basic'],
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), statsPeriod: '60d', project: '-1'}},
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

    await tick();

    const results = wrapper.find('Results');

    expect(results.state('needConfirmation')).toEqual(true);
  });

  it('needs confirmation on long query with explicit projects', async function () {
    const organization = TestStubs.Organization({
      features: ['discover-basic'],
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {
          query: {
            ...generateFields(),
            statsPeriod: '60d',
            project: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          },
        },
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

    await tick();

    const results = wrapper.find('Results');

    expect(results.state('needConfirmation')).toEqual(true);
  });

  it('does not need confirmation on short queries', async function () {
    const organization = TestStubs.Organization({
      features: ['discover-basic'],
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), statsPeriod: '30d', project: '-1'}},
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

    await tick();

    const results = wrapper.find('Results');

    expect(results.state('needConfirmation')).toEqual(false);
  });

  it('does not need confirmation with to few projects', async function () {
    const organization = TestStubs.Organization({
      features: ['discover-basic'],
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {
          query: {...generateFields(), statsPeriod: '90d', project: [1, 2, 3, 4]},
        },
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

    await tick();

    const results = wrapper.find('Results');

    expect(results.state('needConfirmation')).toEqual(false);
  });
});
