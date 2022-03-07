import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {act} from 'sentry-test/reactTestingLibrary';

import * as globalActions from 'sentry/actionCreators/pageFilters';
import OrganizationActions from 'sentry/actions/organizationActions';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {getItem} from 'sentry/utils/localStorage';
import {OrganizationContext} from 'sentry/views/organizationContext';

const changeQuery = (routerContext, query) => ({
  ...routerContext,
  context: {
    ...routerContext.context,
    router: {
      ...routerContext.context.router,
      location: {
        query,
      },
    },
  },
});

jest.mock('sentry/utils/localStorage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('GlobalSelectionHeader', function () {
  enforceActOnUseLegacyStoreHook();

  let wrapper;
  const {organization, router, routerContext} = initializeOrg({
    organization: {features: ['global-views']},
    projects: [
      {
        id: 2,
        slug: 'project-2',
      },
      {
        id: 3,
        slug: 'project-3',
        environments: ['prod', 'staging'],
      },
    ],
    router: {
      location: {query: {}},
      params: {orgId: 'org-slug'},
    },
  });

  beforeAll(function () {
    jest.spyOn(globalActions, 'updateDateTime');
    jest.spyOn(globalActions, 'updateEnvironments');
    jest.spyOn(globalActions, 'updateProjects');
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData(organization.projects);
    OrganizationActions.update(organization);
    OrganizationsStore.add(organization);

    getItem.mockImplementation(() => null);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
  });

  afterEach(function () {
    wrapper.unmount();
    [
      globalActions.updateDateTime,
      globalActions.updateProjects,
      globalActions.updateEnvironments,
      router.push,
      router.replace,
      getItem,
    ].forEach(mock => mock.mockClear());
    PageFiltersStore.reset();
  });

  it('does not update router if there is custom routing', function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer organization={organization} hasCustomRouting />,
      routerContext
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not update router if org in URL params is different than org in context/props', function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer organization={organization} hasCustomRouting />,
      {
        ...routerContext,
        context: {
          ...routerContext.context,
          router: {...routerContext.context.router, params: {orgId: 'diff-org'}},
        },
      }
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not replace URL with values from store when mounted with no query params', function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer organization={organization} />,
      routerContext
    );

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('only updates GlobalSelection store when mounted with query params', async function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer
        organization={organization}
        params={{orgId: organization.slug}}
      />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      })
    );

    expect(router.push).not.toHaveBeenCalled();

    await tick();

    expect(PageFiltersStore.getState().selection).toEqual({
      datetime: {
        period: '7d',
        utc: null,
        start: null,
        end: null,
      },
      environments: [],
      projects: [],
    });
  });

  it('can change environments with a project selected', async function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer
        organization={organization}
        projects={organization.projects}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    mockRouterPush(wrapper, router);

    // Open dropdown and select one project
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
    wrapper.find('MultipleProjectSelector CheckboxFancy').at(1).simulate('click');
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();
    expect(wrapper.find('MultipleProjectSelector Content').text()).toBe('project-3');

    // Select environment
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper.find('MultipleEnvironmentSelector CheckboxFancy').at(0).simulate('click');
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();

    expect(wrapper.find('MultipleEnvironmentSelector Content').text()).toBe('prod');

    expect(PageFiltersStore.getState().selection).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: ['prod'],
      projects: [3],
    });
    const query = wrapper.prop('location').query;
    expect(query).toEqual({
      environment: 'prod',
      project: '3',
    });
  });

  it('updates environments when switching projects', async function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer
        organization={organization}
        projects={organization.projects}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    mockRouterPush(wrapper, router);

    // Open dropdown and select both projects
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
    wrapper.find('MultipleProjectSelector CheckboxFancy').at(0).simulate('click');
    wrapper.find('MultipleProjectSelector CheckboxFancy').at(1).simulate('click');
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();
    expect(wrapper.find('MultipleProjectSelector Content').text()).toBe(
      'project-2, project-3'
    );

    // Select environment
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper.find('MultipleEnvironmentSelector CheckboxFancy').at(1).simulate('click');
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();

    expect(wrapper.find('MultipleEnvironmentSelector Content').text()).toBe('staging');

    expect(PageFiltersStore.getState().selection).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: ['staging'],
      projects: [2, 3],
    });
    const query = wrapper.prop('location').query;
    expect(query).toEqual({
      environment: 'staging',
      project: ['2', '3'],
    });

    // Now change projects, first project has no environments
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
    wrapper.find('MultipleProjectSelector CheckboxFancy').at(1).simulate('click');

    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();

    // Store should not have any environments selected
    expect(PageFiltersStore.getState().selection).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: [],
      projects: [2],
    });
    expect(wrapper.find('MultipleEnvironmentSelector Content').text()).toBe(
      'All Environments'
    );
  });

  it('shows environments for non-member projects', async function () {
    const initialData = initializeOrg({
      organization: {features: ['global-views']},
      projects: [
        {id: 1, slug: 'staging-project', environments: ['staging'], isMember: false},
        {id: 2, slug: 'prod-project', environments: ['prod']},
      ],
      router: {
        location: {query: {project: ['1']}},
        params: {orgId: 'org-slug'},
      },
    });
    ProjectsStore.loadInitialData(initialData.projects);

    wrapper = mountWithTheme(
      <PageFiltersContainer
        router={initialData.router}
        organization={initialData.organization}
        projects={initialData.projects}
      />,
      changeQuery(initialData.routerContext, {project: 1})
    );
    await tick();
    wrapper.update();

    // Open environment picker
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    const checkboxes = wrapper.find('MultipleEnvironmentSelector AutoCompleteItem');

    expect(checkboxes).toHaveLength(1);
    expect(checkboxes.text()).toBe('staging');
  });

  it('updates GlobalSelection store with default period', async function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer organization={organization} />,
      changeQuery(routerContext, {
        environment: 'prod',
      })
    );

    await tick();

    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      selection: {
        datetime: {
          period: '14d',
          utc: null,
          start: null,
          end: null,
        },
        environments: ['prod'],
        projects: [],
      },
    });
    // Not called because of the default date
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('updates GlobalSelection store with empty dates in URL', async function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer organization={organization} />,
      changeQuery(routerContext, {
        statsPeriod: null,
      })
    );

    await tick();

    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      selection: {
        datetime: {
          period: '14d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('resets start&end if showAbsolute prop is false', async function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer organization={organization} showAbsolute={false} />,
      changeQuery(routerContext, {
        start: '2020-05-05T07:26:53.000',
        end: '2020-05-05T09:19:12.000',
      })
    );

    await tick();

    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      selection: {
        datetime: {
          period: '14d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  /**
   * I don't think this test is really applicable anymore
   */
  it('does not update store if url params have not changed', async function () {
    wrapper = mountWithTheme(
      <PageFiltersContainer organization={organization} />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      })
    );

    [
      globalActions.updateDateTime,
      globalActions.updateProjects,
      globalActions.updateEnvironments,
    ].forEach(mock => mock.mockClear());

    wrapper.setContext(
      changeQuery(routerContext, {
        statsPeriod: '7d',
      }).context
    );

    await tick();
    wrapper.update();

    expect(globalActions.updateDateTime).not.toHaveBeenCalled();
    expect(globalActions.updateProjects).not.toHaveBeenCalled();
    expect(globalActions.updateEnvironments).not.toHaveBeenCalled();

    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      selection: {
        datetime: {
          period: '7d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('loads from local storage when no URL parameters', async function () {
    getItem.mockImplementation(() =>
      JSON.stringify({projects: [3], environments: ['staging']})
    );
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
      },
    });

    wrapper = mountWithTheme(
      <PageFiltersContainer organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    await tick(); // reflux tick

    expect(PageFiltersStore.getState().selection.projects).toEqual([3]);
    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: {
          environment: ['staging'],
          project: ['3'],
        },
      })
    );
  });

  it('does not load from local storage when there are URL params', async function () {
    getItem.mockImplementation(() =>
      JSON.stringify({projects: [3], environments: ['staging']})
    );

    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {query: {project: ['1', '2']}},
      },
    });

    wrapper = mountWithTheme(
      <PageFiltersContainer organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    await tick(); // reflux tick

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);
    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store when there are query params in URL', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {query: {project: ['1', '2']}},
      },
    });

    wrapper = mountWithTheme(
      <PageFiltersContainer organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    await tick(); // reflux tick

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);
    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with default values when there are no query params in URL', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {query: {}},
      },
    });

    wrapper = mountWithTheme(
      <PageFiltersContainer organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    // Router does not update because params have not changed
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with desynced values when url params do not match local storage', async function () {
    getItem.mockImplementation(() =>
      JSON.stringify({
        projects: [1],
        pinnedFilters: ['projects'],
      })
    );

    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views', 'selection-filters-v2'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {
          query: {project: ['2']},
          // TODO: This is only temporary while selection-filters-v2 is limited
          // to certan pages
          pathname: '/organizations/org-slug/issues/',
        },
      },
    });

    OrganizationActions.update(initializationObj.organization);

    wrapper = mountWithTheme(
      <OrganizationContext.Provider value={initializationObj.organization}>
        <PageFiltersContainer
          organization={initializationObj.organization}
          hideGlobalHeader
        />
      </OrganizationContext.Provider>,

      initializationObj.routerContext
    );

    // reflux tick
    await tick();
    expect(PageFiltersStore.getState().selection.projects).toEqual([2]);

    // Wait for desynced filters to update
    await tick();
    expect(PageFiltersStore.getState().desyncedFilters).toEqual(new Set(['projects']));

    wrapper.update();
    expect(wrapper.find('DesyncedFilterAlert')).toHaveLength(1);
  });

  /**
   * GSH: (no global-views)
   * - mounts with no state from router
   *   - params org id === org.slug
   *
   * - updateProjects should not be called (enforceSingleProject should not be
   *   called)
   *
   * - componentDidUpdate with loadingProjects === true, and pass in list of
   *   projects (via projects store)
   *
   * - enforceProject should be called and updateProjects() called with the new
   *   project
   *   - variation:
   *     - params.orgId !== org.slug (e.g. just switched orgs)
   *
   * When switching orgs when not in Issues view, the issues view gets rendered
   * with params.orgId !== org.slug
   *
   * Global selection header gets unmounted and mounted, and in this case
   * nothing should be done until it gets updated and params.orgId === org.slug
   *
   * Separate issue:
   *
   * IssuesList ("child view") renders before a single project is enforced,
   * will require refactoring views so that they depend on GSH enforcing a
   * single project first IF they don't have required feature (and no project id
   * in URL).
   */
  describe('Single project selection mode', function () {
    it('does not do anything while organization is switching in single project', async function () {
      const initialData = initializeOrg({
        organization: {slug: 'old-org-slug'},
        router: {
          // we need this to be set to make sure org in context is same as
          // current org in URL
          params: {orgId: 'org-slug'},
          location: {query: {project: ['1']}},
        },
      });

      MockApiClient.addMockResponse({
        url: '/organizations/old-org-slug/projects/',
        body: [],
      });

      ProjectsStore.reset();

      // This can happen when you switch organization so params.orgId !== the
      // current org in context In this case params.orgId = 'org-slug'
      wrapper = mountWithTheme(
        <PageFiltersContainer organization={initialData.organization} />,
        initialData.routerContext
      );
      expect(globalActions.updateProjects).not.toHaveBeenCalled();

      const updatedOrganization = {
        ...organization,
        slug: 'org-slug',
        features: [],
        projects: [TestStubs.Project({id: '123', slug: 'org-slug-project1'})],
      };

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: updatedOrganization,
      });

      // Eventually OrganizationContext will fetch org details for `org-slug`
      // and update `organization` prop emulate fetchOrganizationDetails
      OrganizationActions.update(updatedOrganization);
      wrapper.setContext({
        organization: updatedOrganization,
        location: {query: {}},
        router: {
          ...initialData.router,
          location: {query: {}},
        },
      });
      wrapper.setProps({organization: updatedOrganization});

      act(() => ProjectsStore.loadInitialData(updatedOrganization.projects));

      expect(initialData.router.replace).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['123']},
        })
      );
    });

    it('selects first project if more than one is requested', function () {
      const initializationObj = initializeOrg({
        router: {
          // we need this to be set to make sure org in context is same as
          // current org in URL
          params: {orgId: 'org-slug'},
          location: {query: {project: ['1', '2']}},
        },
      });

      wrapper = mountWithTheme(
        <PageFiltersContainer organization={initializationObj.organization} />,
        initializationObj.routerContext
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['1']},
        })
      );
    });

    it('selects first project if none (i.e. all) is requested', async function () {
      const project = TestStubs.Project({id: '3'});
      const org = TestStubs.Organization({projects: [project]});

      ProjectsStore.loadInitialData(org.projects);

      const initializationObj = initializeOrg({
        organization: org,
        router: {
          params: {orgId: 'org-slug'},
          location: {query: {}},
        },
      });

      wrapper = mountWithTheme(
        <PageFiltersContainer organization={initializationObj.organization} />,
        initializationObj.routerContext
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['3']},
        })
      );
    });
  });

  describe('forceProject selection mode', function () {
    beforeEach(async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      const initialData = initializeOrg({
        organization: {features: ['global-views']},
        projects: [
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {}},
        },
      });

      ProjectsStore.loadInitialData(initialData.projects);

      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          shouldForceProject
          forceProject={initialData.projects[0]}
          showIssueStreamLink
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();
    });

    it('renders a back button to the forced project', function () {
      const back = wrapper.find('BackButtonWrapper');
      expect(back).toHaveLength(1);
    });

    it('renders only environments from the forced project', function () {
      wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      wrapper.update();

      const items = wrapper.find('MultipleEnvironmentSelector EnvironmentSelectorItem');
      expect(items.length).toEqual(1);
      expect(items.at(0).text()).toBe('staging');
    });
  });

  describe('forceProject + forceEnvironment selection mode', function () {
    beforeEach(async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      const initialData = initializeOrg({
        organization: {features: ['global-views']},
        projects: [
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
      });

      ProjectsStore.loadInitialData(initialData.projects);

      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          shouldForceProject
          forceProject={initialData.projects[0]}
          forceEnvironment="test-env"
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();
    });

    it('renders the forced environment', function () {
      expect(wrapper.find('MultipleEnvironmentSelector HeaderItem').text()).toBe(
        'test-env'
      );
    });
  });

  describe('without global-views (multi-project feature)', function () {
    describe('without existing URL params', function () {
      const initialData = initializeOrg({
        projects: [
          {id: 0, slug: 'random project', isMember: true},
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      const createWrapper = props => {
        wrapper = mountWithTheme(
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            organization={initialData.organization}
            {...props}
          />,
          initialData.routerContext
        );
        return wrapper;
      };

      beforeEach(function () {
        ProjectsStore.loadInitialData(initialData.projects);

        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('uses first project in org projects when mounting', async function () {
        createWrapper();

        // Projects are returned in sorted slug order, so `prod-project` would
        // be the first project
        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {cursor: undefined, environment: [], project: ['2']},
        });
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', async function () {
        ProjectsStore.reset();

        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        wrapper.setProps({
          forceProject: initialData.projects[1],
        });

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: ['1']},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', async function () {
        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        wrapper.setContext({
          router: {
            ...initialData.router,
            location: {
              ...initialData.router.location,
              query: {
                project: '321',
              },
            },
          },
        });
        wrapper.setProps({
          forceProject: initialData.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when mounted with `forceProject`', async function () {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: ['1']},
        });
      });
    });

    describe('with existing URL params', function () {
      const initialData = initializeOrg({
        projects: [
          {id: 0, slug: 'random project', isMember: true},
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {statsPeriod: '90d'}},
          params: {orgId: 'org-slug'},
        },
      });
      ProjectsStore.loadInitialData(initialData.projects);

      const createWrapper = props => {
        wrapper = mountWithTheme(
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            organization={initialData.organization}
            {...props}
          />,
          initialData.routerContext
        );
        return wrapper;
      };

      beforeEach(function () {
        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('appends projectId to URL when mounted with `forceProject`', async function () {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: ['1'], statsPeriod: '90d'},
        });
      });
    });
  });

  describe('with global-views (multi-project feature)', function () {
    describe('without existing URL params', function () {
      const initialData = initializeOrg({
        organization: {features: ['global-views']},
        projects: [
          {id: 0, slug: 'random project', isMember: true},
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      const createWrapper = (props, ctx) => {
        wrapper = mountWithTheme(
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            organization={initialData.organization}
            {...props}
          />,
          {
            ...initialData.routerContext,
            ...ctx,
          }
        );
        return wrapper;
      };

      beforeEach(function () {
        ProjectsStore.loadInitialData(initialData.projects);

        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('does not use first project in org projects when mounting (and without localStorage data)', async function () {
        createWrapper();

        await tick();
        wrapper.update();

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('does not append projectId to URL when `loadingProjects` changes and finishes loading', async function () {
        ProjectsStore.reset();

        createWrapper();

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        wrapper.setProps({
          forceProject: initialData.projects[1],
        });

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', async function () {
        ProjectsStore.reset();

        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        wrapper.setProps({
          forceProject: initialData.projects[1],
        });

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: ['1']},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', async function () {
        // forceProject generally starts undefined
        createWrapper(
          {shouldForceProject: true},
          changeQuery(initialData.routerContext, {project: 321})
        );

        await tick();

        wrapper.setProps({
          forceProject: initialData.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });
    });
  });

  describe('projects list', function () {
    let memberProject, nonMemberProject, initialData;

    beforeEach(async function () {
      memberProject = TestStubs.Project({id: '3', isMember: true});
      nonMemberProject = TestStubs.Project({id: '4', isMember: false});
      initialData = initializeOrg({
        projects: [memberProject, nonMemberProject],
        router: {
          location: {query: {}},
          params: {
            orgId: 'org-slug',
          },
        },
      });

      ProjectsStore.loadInitialData(initialData.projects);

      wrapper = mountWithTheme(
        <PageFiltersContainer organization={initialData.organization} />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();
    });

    it('gets member projects', function () {
      expect(wrapper.find('MultipleProjectSelector').prop('projects')).toEqual([
        memberProject,
      ]);
    });

    it('gets all projects if superuser', async function () {
      ConfigStore.config = {
        user: {
          isSuperuser: true,
        },
      };

      wrapper = mountWithTheme(
        <PageFiltersContainer organization={initialData.organization} />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('MultipleProjectSelector').prop('projects')).toEqual([
        memberProject,
      ]);

      expect(wrapper.find('MultipleProjectSelector').prop('nonMemberProjects')).toEqual([
        nonMemberProject,
      ]);
    });

    it('shows "My Projects" button', async function () {
      initialData.organization.features.push('global-views');
      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          projects={initialData.projects}
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // My projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('Select My Projects');
    });

    it('shows "All Projects" button based on features', async function () {
      initialData.organization.features.push('global-views');
      initialData.organization.features.push('open-membership');
      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          projects={initialData.projects}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // All projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('Select All Projects');
    });

    it('shows "All Projects" button based on role', async function () {
      initialData.organization.features.push('global-views');
      initialData.organization.role = 'owner';
      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          projects={initialData.projects}
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();
      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // All projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('Select All Projects');
    });

    it('shows "My Projects" when "all projects" is selected', async function () {
      initialData.organization.features.push('global-views');
      initialData.organization.role = 'owner';

      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          projects={initialData.projects}
        />,
        changeQuery(initialData.routerContext, {project: -1})
      );

      await tick();
      wrapper.update();

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // My projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('Select My Projects');
    });
  });

  describe('project icons', function () {
    const initialData = initializeOrg({
      organization: {features: ['global-views']},
      projects: [
        {id: 0, slug: 'go', platform: 'go'},
        {id: 1, slug: 'javascript', platform: 'javascript'},
        {id: 2, slug: 'other', platform: 'other'},
        {id: 3, slug: 'php', platform: 'php'},
        {id: 4, slug: 'python', platform: 'python'},
        {id: 5, slug: 'rust', platform: 'rust'},
        {id: 6, slug: 'swift', platform: 'swift'},
      ],
    });

    beforeEach(function () {
      ProjectsStore.loadInitialData(initialData.projects);
    });

    it('shows IconProject when no projects are selected', async function () {
      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          projects={initialData.projects}
        />,
        changeQuery(initialData.routerContext, {project: -1})
      );

      await tick();
      wrapper.update();

      const projectSelector = wrapper.find('MultipleProjectSelector');

      expect(projectSelector.find('IconContainer svg').exists()).toBeTruthy();
      expect(projectSelector.find('PlatformIcon').exists()).toBeFalsy();

      expect(projectSelector.find('Content').text()).toEqual('All Projects');
    });

    it('shows PlatformIcon when one project is selected', async function () {
      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          projects={initialData.projects}
        />,
        changeQuery(initialData.routerContext, {project: 1})
      );

      await tick();
      wrapper.update();

      const projectSelector = wrapper.find('MultipleProjectSelector');

      expect(projectSelector.find('StyledPlatformIcon').props().platform).toEqual(
        'javascript'
      );

      expect(projectSelector.find('Content').text()).toEqual('javascript');
    });

    it('shows multiple PlatformIcons when multiple projects are selected, no more than 5', async function () {
      wrapper = mountWithTheme(
        <PageFiltersContainer
          organization={initialData.organization}
          projects={initialData.projects}
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();

      // select 6 projects
      const headerItem = wrapper.find('MultipleProjectSelector HeaderItem');
      headerItem.simulate('click');
      wrapper
        .find('MultipleProjectSelector CheckboxFancy')
        .forEach(project => project.simulate('click'));
      headerItem.simulate('click');

      await tick();
      wrapper.update();

      // assert title and icons
      const title = wrapper.find('MultipleProjectSelector Content');
      const icons = wrapper.find('MultipleProjectSelector StyledPlatformIcon');
      expect(title.text()).toBe('javascript, other, php, python, rust, swift');
      expect(icons.length).toBe(5);
      expect(icons.at(3).props().platform).toBe('rust');
      expect(icons.at(4).props().platform).toBe('swift');
    });
  });
});
