import {browserHistory} from 'react-router';

import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {triggerPress} from 'sentry-test/utils';

import * as PageFilterPersistence from 'sentry/components/organizations/pageFilters/persistence';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import Results from 'sentry/views/eventsV2/results';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {DEFAULT_EVENT_VIEW, TRANSACTION_VIEWS} from './data';

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

describe('Results', function () {
  enforceActOnUseLegacyStoreHook();

  const eventTitle = 'Oh no something bad';
  let eventsResultsMock, eventsv2ResultsMock, mockSaved, eventsStatsMock, mockVisit;

  const mountWithThemeAndOrg = (component, opts, organization) =>
    mountWithTheme(component, {
      ...opts,
      wrappingComponent: ({children}) => (
        <OrganizationContext.Provider value={organization}>
          {children}
        </OrganizationContext.Provider>
      ),
    });

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
    const eventsV2ResultsMockBody = {
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
    };
    const eventsResultsMockBody = {
      meta: {
        fields: {
          id: 'string',
          title: 'string',
          'project.name': 'string',
          timestamp: 'date',
          'user.id': 'string',
        },
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
    };
    eventsv2ResultsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: eventsV2ResultsMockBody,
    });
    eventsResultsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: eventsResultsMockBody,
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
          topValues: [{count: 3, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'environment',
          topValues: [{count: 2, value: 'dev', name: 'dev'}],
        },
        {
          key: 'foo',
          topValues: [{count: 1, value: 'bar', name: 'bar'}],
        },
      ],
    });
    mockVisit = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/1/visit/',
      method: 'POST',
      body: [],
      statusCode: 200,
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
      body: {
        id: '2',
        name: '',
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
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());
  });

  describe('EventsV2', function () {
    const features = ['discover-basic'];
    it('loads data when moving from an invalid to valid EventView', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      // Start off with an invalid view (empty is invalid)
      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {query: 'tag:value'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();
      wrapper.update();

      // No request as eventview was invalid.
      expect(eventsv2ResultsMock).not.toHaveBeenCalled();

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
      expect(eventsv2ResultsMock).toHaveBeenCalled();
    });

    it('pagination cursor should be cleared when making a search', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {
            query: {
              ...generateFields(),
              cursor: '0%3A50%3A0',
            },
          },
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
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

      // should only be called with saved queries
      expect(mockVisit).not.toHaveBeenCalled();

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
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );
      // y-axis selector is last.
      const selector = wrapper.find('OptionSelector').last();

      // Open the selector
      act(() => {
        triggerPress(selector.find('button[aria-haspopup="listbox"]'));
      });
      await tick();
      wrapper.update();

      // Click one of the options.
      wrapper.find('Option').first().simulate('click');
      await tick();
      wrapper.update();

      const eventsRequest = wrapper.find('EventsChart');
      expect(eventsRequest.props().yAxis).toEqual(['count()']);
      wrapper.unmount();
    });

    it('renders a display selector', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count'}},
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      act(() => ProjectsStore.loadInitialData([TestStubs.Project()]));
      await tick();
      wrapper.update();

      // display selector is first.
      const selector = wrapper.find('OptionSelector').first();

      // Open the selector
      act(() => {
        triggerPress(selector.find('button[aria-haspopup="listbox"]'));
      });
      await tick();
      wrapper.update();

      // Click the 'default' option.
      wrapper.find('Option').first().simulate('click');
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
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'previous'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );
      // display selector is first.
      const selector = wrapper.find('OptionSelector').first();

      // Open the selector
      act(() => {
        triggerPress(selector.find('button[aria-haspopup="listbox"]'));
      });
      await tick();
      wrapper.update();

      // Make sure the top5 option isn't present
      const options = wrapper
        .find('Option [data-test-id]')
        .map(item => item.prop('data-test-id'));
      expect(options).not.toContain('top5');
      expect(options).not.toContain('dailytop5');
      expect(options).toContain('default');
      wrapper.unmount();
    });

    it('needs confirmation on long queries', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), statsPeriod: '60d', project: '-1'}},
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(true);
      wrapper.unmount();
    });

    it('needs confirmation on long query with explicit projects', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
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

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(true);
      wrapper.unmount();
    });

    it('does not need confirmation on short queries', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), statsPeriod: '30d', project: '-1'}},
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(false);
      wrapper.unmount();
    });

    it('does not need confirmation with to few projects', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {
            query: {...generateFields(), statsPeriod: '90d', project: [1, 2, 3, 4]},
          },
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(false);
      wrapper.unmount();
    });

    it('retrieves saved query', async function () {
      const organization = TestStubs.Organization({
        features,
        slug: 'org-slug',
      });
      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {id: '1', statsPeriod: '24h'}},
        },
      });
      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
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
      expect(mockVisit).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });

    it('creates event view from saved query', async function () {
      const organization = TestStubs.Organization({
        features,
        slug: 'org-slug',
      });
      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {id: '1', statsPeriod: '24h'}},
        },
      });
      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
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
      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const eventView = wrapper.find('Results').state('eventView');

      expect(eventView.name).toEqual('new');
      expect(eventView.id).toEqual('1');
      expect(eventView.fields.length).toEqual(5);
      expect(eventView.project).toEqual([2]);
      expect(eventView.statsPeriod).toEqual('7d');
      expect(eventView.environment).toEqual(['production']);
      expect(mockVisit).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });

    it('updates chart whenever yAxis parameter changes', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
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
            yAxis: ['count_unique(user)'],
          }),
        })
      );
      wrapper.unmount();
    });

    it('updates chart whenever display parameter changes', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
          }),
        })
      );

      // Update location simulating a browser back button action
      wrapper.setProps({
        location: {
          query: {...generateFields(), display: 'previous', yAxis: 'count()'},
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
            yAxis: ['count()'],
          }),
        })
      );
      wrapper.unmount();
    });

    it('updates chart whenever display and yAxis parameters change', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
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
            yAxis: ['count_unique(user)'],
          }),
        })
      );
      wrapper.unmount();
    });
  });

  describe('Events', function () {
    const features = ['discover-basic', 'discover-frontend-use-events-endpoint'];
    it('loads data when moving from an invalid to valid EventView', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      // Start off with an invalid view (empty is invalid)
      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {query: 'tag:value'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();
      wrapper.update();

      // No request as eventview was invalid.
      expect(eventsResultsMock).not.toHaveBeenCalled();

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
      expect(eventsResultsMock).toHaveBeenCalled();
    });

    it('pagination cursor should be cleared when making a search', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {
            query: {
              ...generateFields(),
              cursor: '0%3A50%3A0',
            },
          },
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
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

      // should only be called with saved queries
      expect(mockVisit).not.toHaveBeenCalled();

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
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );
      // y-axis selector is last.
      const selector = wrapper.find('OptionSelector').last();

      // Open the selector
      act(() => {
        triggerPress(selector.find('button[aria-haspopup="listbox"]'));
      });
      await tick();
      wrapper.update();

      // Click one of the options.
      wrapper.find('Option').first().simulate('click');
      await tick();
      wrapper.update();

      const eventsRequest = wrapper.find('EventsChart');
      expect(eventsRequest.props().yAxis).toEqual(['count()']);
      wrapper.unmount();
    });

    it('renders a display selector', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count'}},
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      act(() => ProjectsStore.loadInitialData([TestStubs.Project()]));
      await tick();
      wrapper.update();

      // display selector is first.
      const selector = wrapper.find('OptionSelector').first();

      // Open the selector
      act(() => {
        triggerPress(selector.find('button[aria-haspopup="listbox"]'));
      });
      await tick();
      wrapper.update();

      // Click the 'default' option.
      wrapper.find('Option').first().simulate('click');
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
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'previous'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );
      // display selector is first.
      const selector = wrapper.find('OptionSelector').first();

      // Open the selector
      act(() => {
        triggerPress(selector.find('button[aria-haspopup="listbox"]'));
      });
      await tick();
      wrapper.update();

      // Make sure the top5 option isn't present
      const options = wrapper
        .find('Option [data-test-id]')
        .map(item => item.prop('data-test-id'));
      expect(options).not.toContain('top5');
      expect(options).not.toContain('dailytop5');
      expect(options).toContain('default');
      wrapper.unmount();
    });

    it('needs confirmation on long queries', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), statsPeriod: '60d', project: '-1'}},
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(true);
      wrapper.unmount();
    });

    it('needs confirmation on long query with explicit projects', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
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

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(true);
      wrapper.unmount();
    });

    it('does not need confirmation on short queries', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), statsPeriod: '30d', project: '-1'}},
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(false);
      wrapper.unmount();
    });

    it('does not need confirmation with to few projects', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic'],
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {
            query: {...generateFields(), statsPeriod: '90d', project: [1, 2, 3, 4]},
          },
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const results = wrapper.find('Results');

      expect(results.state('needConfirmation')).toEqual(false);
      wrapper.unmount();
    });

    it('retrieves saved query', async function () {
      const organization = TestStubs.Organization({
        features,
        slug: 'org-slug',
      });
      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {id: '1', statsPeriod: '24h'}},
        },
      });
      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
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
      expect(mockVisit).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });

    it('creates event view from saved query', async function () {
      const organization = TestStubs.Organization({
        features,
        slug: 'org-slug',
      });
      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {id: '1', statsPeriod: '24h'}},
        },
      });
      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
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
      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      await tick();

      const eventView = wrapper.find('Results').state('eventView');

      expect(eventView.name).toEqual('new');
      expect(eventView.id).toEqual('1');
      expect(eventView.fields.length).toEqual(5);
      expect(eventView.project).toEqual([2]);
      expect(eventView.statsPeriod).toEqual('7d');
      expect(eventView.environment).toEqual(['production']);
      expect(mockVisit).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });

    it('updates chart whenever yAxis parameter changes', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
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
            yAxis: ['count_unique(user)'],
          }),
        })
      );
      wrapper.unmount();
    });

    it('updates chart whenever display parameter changes', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
          }),
        })
      );

      // Update location simulating a browser back button action
      wrapper.setProps({
        location: {
          query: {...generateFields(), display: 'previous', yAxis: 'count()'},
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
            yAxis: ['count()'],
          }),
        })
      );
      wrapper.unmount();
    });

    it('updates chart whenever display and yAxis parameters change', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
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
            yAxis: ['count_unique(user)'],
          }),
        })
      );
      wrapper.unmount();
    });

    it('appends tag value to existing query when clicked', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count'}},
        },
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      act(() => ProjectsStore.loadInitialData([TestStubs.Project()]));
      await tick();
      wrapper.update();

      wrapper.find('[data-test-id="toggle-show-tags"]').first().simulate('click');
      await tick();
      wrapper.update();

      // since environment collides with the environment field, it is wrapped with `tags[...]`
      const envSegment = wrapper.find(
        '[data-test-id="tag-environment-segment-dev"] Segment'
      );
      const envTarget = envSegment.props().to;
      expect(envTarget.query.query).toEqual('tags[environment]:dev');

      const fooSegment = wrapper.find('[data-test-id="tag-foo-segment-bar"] Segment');
      const fooTarget = fooSegment.props().to;
      expect(fooTarget.query.query).toEqual('foo:bar');
    });

    it('respects pinned filters for prebuilt queries', async function () {
      const organization = TestStubs.Organization({
        features: [...features, 'global-views'],
      });

      const initialData = initializeOrg({
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count'}},
        },
      });

      jest.spyOn(PageFilterPersistence, 'getPageFilterStorage').mockReturnValue({
        state: {
          project: [1],
          environment: [],
          start: null,
          end: null,
          period: '14d',
          utc: null,
        },
        pinnedFilters: new Set(['projects']),
      });

      const wrapper = mountWithThemeAndOrg(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        initialData.routerContext,
        organization
      );

      act(() =>
        ProjectsStore.loadInitialData([
          TestStubs.Project({id: 1, slug: 'Pinned Project'}),
        ])
      );
      await tick();
      wrapper.update();

      const projectPageFilter = wrapper
        .find('[data-test-id="page-filter-project-selector"]')
        .first();

      expect(projectPageFilter.text()).toEqual('Pinned Project');
    });
  });

  it('renders metric fallback alert', async function () {
    const organization = TestStubs.Organization({
      features: ['discover-basic'],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {fromMetric: true, id: '1'}},
      },
    });

    ProjectsStore.loadInitialData([TestStubs.Project()]);

    const wrapper = mountWithThemeAndOrg(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext,
      organization
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Alert').find('Message').text()).toEqual(
      "You've navigated to this page from a performance metric widget generated from processed events. The results here only show indexed events."
    );
  });

  it('renders unparameterized data banner', async function () {
    const organization = TestStubs.Organization({
      features: ['discover-basic'],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {showUnparameterizedBanner: true, id: '1'}},
      },
    });

    ProjectsStore.loadInitialData([TestStubs.Project()]);

    const wrapper = mountWithThemeAndOrg(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext,
      organization
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Alert').find('Message').text()).toEqual(
      'These are unparameterized transactions. To better organize your transactions, set transaction names manually.'
    );
  });

  it('updates the homepage query with up to date eventView when Set as Default is clicked', async () => {
    const mockHomepageUpdate = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'PUT',
      statusCode: 200,
    });
    const organization = TestStubs.Organization({
      features: [
        'discover-basic',
        'discover-query',
        'discover-query-builder-as-landing-page',
      ],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        // These fields take priority and should be sent in the request
        location: {query: {field: ['title', 'user'], id: '1'}},
      },
    });

    ProjectsStore.loadInitialData([TestStubs.Project()]);

    render(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      {context: initialData.routerContext, organization}
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: /set as default/i})).toBeEnabled()
    );
    userEvent.click(screen.getByText('Set as Default'));

    expect(mockHomepageUpdate).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/homepage/',
      expect.objectContaining({
        data: expect.objectContaining({
          fields: ['title', 'user'],
        }),
      })
    );
  });

  it('Changes the Use as Discover button to a reset button for saved query', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'PUT',
      statusCode: 200,
      body: {
        id: '2',
        name: '',
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
        range: '14d',
        orderby: '-user.display',
      },
    });
    const organization = TestStubs.Organization({
      features: [
        'discover-basic',
        'discover-query',
        'discover-query-builder-as-landing-page',
      ],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {id: '1'}},
      },
    });

    ProjectsStore.loadInitialData([TestStubs.Project()]);

    const {rerender} = render(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      {context: initialData.routerContext, organization}
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: /set as default/i})).toBeEnabled()
    );
    userEvent.click(screen.getByText('Set as Default'));
    expect(await screen.findByText('Remove Default')).toBeInTheDocument();

    userEvent.click(screen.getByText('Total Period'));
    userEvent.click(screen.getByText('Previous Period'));
    const rerenderData = initializeOrg({
      organization,
      router: {
        location: {query: {...initialData.router.location.query, display: 'previous'}},
      },
    });
    rerender(
      <Results
        organization={organization}
        location={rerenderData.router.location}
        router={rerenderData.router}
      />
    );
    screen.getByText('Previous Period');
    expect(await screen.findByText('Set as Default')).toBeInTheDocument();
  });

  it('Changes the Use as Discover button to a reset button for prebuilt query', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'PUT',
      statusCode: 200,
      body: {...TRANSACTION_VIEWS[0], name: ''},
    });
    const organization = TestStubs.Organization({
      features: [
        'discover-basic',
        'discover-query',
        'discover-query-builder-as-landing-page',
      ],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...TestStubs.location(),
          query: {
            ...EventView.fromNewQueryWithLocation(
              TRANSACTION_VIEWS[0],
              TestStubs.location()
            ).generateQueryStringObject(),
          },
        },
      },
    });

    ProjectsStore.loadInitialData([TestStubs.Project()]);

    const {rerender} = render(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      {context: initialData.routerContext, organization}
    );

    await screen.findAllByText(TRANSACTION_VIEWS[0].name);
    userEvent.click(screen.getByText('Set as Default'));
    expect(await screen.findByText('Remove Default')).toBeInTheDocument();

    userEvent.click(screen.getByText('Total Period'));
    userEvent.click(screen.getByText('Previous Period'));
    const rerenderData = initializeOrg({
      organization,
      router: {
        location: {query: {...initialData.router.location.query, display: 'previous'}},
      },
    });
    rerender(
      <Results
        organization={organization}
        location={rerenderData.router.location}
        router={rerenderData.router}
      />
    );
    screen.getByText('Previous Period');
    expect(await screen.findByText('Set as Default')).toBeInTheDocument();
  });

  it('links back to the homepage through the Discover breadcrumb', () => {
    const organization = TestStubs.Organization({
      features: [
        'discover-basic',
        'discover-query',
        'discover-query-builder-as-landing-page',
      ],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {id: '1'}},
      },
    });

    ProjectsStore.loadInitialData([TestStubs.Project()]);

    render(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      {context: initialData.routerContext, organization}
    );

    expect(screen.getByText('Discover')).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp('^/organizations/org-slug/discover/homepage/'))
    );
  });

  it('allows users to Set As Default on the All Events query', () => {
    const organization = TestStubs.Organization({
      features: [
        'discover-basic',
        'discover-query',
        'discover-query-builder-as-landing-page',
      ],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...TestStubs.location(),
          query: {
            ...EventView.fromNewQueryWithLocation(
              DEFAULT_EVENT_VIEW,
              TestStubs.location()
            ).generateQueryStringObject(),
          },
        },
      },
    });

    ProjectsStore.loadInitialData([TestStubs.Project()]);

    render(
      <Results
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
      />,
      {context: initialData.routerContext, organization}
    );

    expect(screen.getByTestId('set-as-default')).toBeEnabled();
  });
});
