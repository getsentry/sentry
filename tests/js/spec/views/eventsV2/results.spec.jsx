import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

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
  let eventResultsMock, mockSaved, eventsStatsMock;

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
    eventsStatsMock = MockApiClient.addMockResponse({
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
    mockSaved = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/1/',
      method: 'GET',
      statusCode: 200,
      body: {
        id: '1',
        name: 'new',
        projects: [],
        version: 2,
        expired: false,
        dateCreated: '2021-04-08T17:53:25.195782Z',
        dateUpdated: '2021-04-09T12:13:18.567264Z',
        createdBy: {
          id: '2',
        },
        environment: [],
        fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
        widths: ['-1', '-1', '-1', '-1', '-1'],
        range: '24h',
        orderby: '-user.display',
      },
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
    await tick();

    // cursor query string should be omitted from the query string
    expect(initialData.router.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        ...generateFields(),
        query: 'geo:canada',
        statsPeriod: '14d',
      },
    });
    wrapper.unmount();
  });

  it('renders a y-axis selector', async function () {
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
    await tick();
    wrapper.update();

    const eventsRequest = wrapper.find('EventsChart');
    expect(eventsRequest.props().yAxis).toEqual('count()');
    wrapper.unmount();
  });

  it('renders a display selector', async function () {
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

    ProjectsStore.loadInitialData(initialData.organization.projects);
    await tick();
    wrapper.update();

    // display selector is first.
    const selector = wrapper.find('OptionSelector').first();

    // Open the selector
    selector.find('StyledDropdownButton button').simulate('click');

    // Click the 'default' option.
    selector
      .find('DropdownMenu MenuItem [data-test-id="option-default"]')
      .first()
      .simulate('click');
    await tick();
    wrapper.update();

    const eventsRequest = wrapper.find('EventsChart').props();
    expect(eventsRequest.disableReleases).toEqual(false);
    expect(eventsRequest.disablePrevious).toEqual(true);
    wrapper.unmount();
  });

  it('excludes top5 options when plan does not include discover-query', async function () {
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
    await tick();

    // Make sure the top5 option isn't present
    const options = selector
      .find('DropdownMenu MenuItem')
      .map(item => item.prop('data-test-id'));
    expect(options).not.toContain('option-top5');
    expect(options).not.toContain('option-dailytop5');
    expect(options).toContain('option-default');
    wrapper.unmount();
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
    wrapper.unmount();
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
    wrapper.unmount();
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
    wrapper.unmount();
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
    wrapper.unmount();
  });

  it('retrieves saved query', async function () {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
      slug: 'org-slug',
    });
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {id: '1', statsPeriod: '24h'}},
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

    const savedQuery = wrapper.find('SavedQueryAPI').state('savedQuery');

    expect(savedQuery.name).toEqual('new');
    expect(savedQuery.id).toEqual('1');
    expect(savedQuery.fields).toEqual([
      'title',
      'event.type',
      'project',
      'user.display',
      'timestamp',
    ]);
    expect(savedQuery.projects).toEqual([]);
    expect(savedQuery.range).toEqual('24h');
    expect(mockSaved).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('creates event view from saved query', async function () {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
      slug: 'org-slug',
    });
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {id: '1', statsPeriod: '24h'}},
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

    const eventView = wrapper.find('Results').state('eventView');

    expect(eventView.name).toEqual('new');
    expect(eventView.id).toEqual('1');
    expect(eventView.fields.length).toEqual(5);
    expect(eventView.project).toEqual([]);
    expect(eventView.statsPeriod).toEqual('24h');
    expect(eventView.sorts).toEqual([{field: 'user.display', kind: 'desc'}]);
    wrapper.unmount();
  });

  it('overrides saved query params with location query params', async function () {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
      slug: 'org-slug',
    });
    const initialData = initializeOrg({
      organization,
      router: {
        location: {
          query: {
            id: '1',
            statsPeriod: '7d',
            project: [2],
            environment: ['production'],
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

    const eventView = wrapper.find('Results').state('eventView');

    expect(eventView.name).toEqual('new');
    expect(eventView.id).toEqual('1');
    expect(eventView.fields.length).toEqual(5);
    expect(eventView.project).toEqual([2]);
    expect(eventView.statsPeriod).toEqual('7d');
    expect(eventView.environment).toEqual(['production']);
    wrapper.unmount();
  });

  it('updates chart whenever yAxis parameter changes', async function () {
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

    ProjectsStore.loadInitialData(initialData.organization.projects);
    await tick();
    wrapper.update();

    // Should load events once
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '14d',
          yAxis: 'count()',
        }),
      })
    );

    // Update location simulating a browser back button action
    wrapper.setProps({
      location: {
        query: {...generateFields(), yAxis: 'count_unique(user)'},
      },
    });
    await tick();
    wrapper.update();

    // Should load events again
    expect(eventsStatsMock).toHaveBeenCalledTimes(2);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '14d',
          yAxis: 'count_unique(user)',
        }),
      })
    );
    wrapper.unmount();
  });

  it('updates chart whenever display parameter changes', async function () {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), display: 'default'}},
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

    // Should load events once
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '14d',
          yAxis: 'count()',
        }),
      })
    );

    // Update location simulating a browser back button action
    wrapper.setProps({
      location: {
        query: {...generateFields(), display: 'previous'},
      },
    });
    await tick();
    wrapper.update();

    // Should load events again
    expect(eventsStatsMock).toHaveBeenCalledTimes(2);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '28d',
          yAxis: 'count()',
        }),
      })
    );
    wrapper.unmount();
  });

  it('updates chart whenever display and yAxis parameters change', async function () {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), display: 'default', yAxis: 'count()'}},
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

    // Should load events once
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '14d',
          yAxis: 'count()',
        }),
      })
    );

    // Update location simulating a browser back button action
    wrapper.setProps({
      location: {
        query: {...generateFields(), display: 'previous', yAxis: 'count_unique(user)'},
      },
    });
    await tick();
    wrapper.update();

    // Should load events again
    expect(eventsStatsMock).toHaveBeenCalledTimes(2);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '28d',
          yAxis: 'count_unique(user)',
        }),
      })
    );
    wrapper.unmount();
  });
});
