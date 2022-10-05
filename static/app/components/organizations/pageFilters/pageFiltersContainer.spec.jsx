import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import * as globalActions from 'sentry/actionCreators/pageFilters';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
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
        ...routerContext.context.router.location,
        query,
      },
    },
  },
});

jest.mock('sentry/utils/localStorage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mountWithThemeAndOrg = (component, opts, organization) =>
  mountWithTheme(component, {
    ...opts,
    wrappingComponent: ({children}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    ),
  });

describe('PageFiltersContainer', function () {
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
      location: {pathname: '/test', query: {}},
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
    OrganizationStore.onUpdate(organization);
    OrganizationsStore.addOrReplace(organization);

    getItem.mockImplementation(() => null);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
  });

  afterEach(function () {
    wrapper.unmount();
    jest.clearAllMocks();
    PageFiltersStore.reset();
  });

  it('does not update router if there is custom routing', function () {
    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer hasCustomRouting />,
      routerContext,
      organization
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not update router if org in URL params is different than org in context/props', function () {
    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer hasCustomRouting />,
      {
        ...routerContext,
        context: {
          ...routerContext.context,
          router: {...routerContext.context.router, params: {orgId: 'diff-org'}},
        },
      },
      organization
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not replace URL with values from store when mounted with no query params', function () {
    wrapper = mountWithThemeAndOrg(<PageFiltersContainer />, routerContext, organization);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('only updates GlobalSelection store when mounted with query params', async function () {
    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer params={{orgId: organization.slug}} />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      }),
      organization
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

  it('updates GlobalSelection store with default period', async function () {
    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer />,
      changeQuery(routerContext, {
        environment: 'prod',
      }),
      organization
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
    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer />,
      changeQuery(routerContext, {
        statsPeriod: null,
      }),
      organization
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
    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer showAbsolute={false} />,
      changeQuery(routerContext, {
        start: '2020-05-05T07:26:53.000',
        end: '2020-05-05T09:19:12.000',
      }),
      organization
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
    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      }),
      organization
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

  it('loads from local storage when no URL parameters and filters are pinned', async function () {
    getItem.mockImplementation(() =>
      JSON.stringify({
        projects: [3],
        environments: ['staging'],
        pinnedFilters: ['projects', 'environments'],
      })
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

    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer />,
      initializationObj.routerContext,
      initializationObj.organization
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
        location: {pathname: '/test', query: {project: ['1', '2']}},
      },
    });

    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer />,
      initializationObj.routerContext,
      initializationObj.organization
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
        location: {pathname: '/test', query: {project: ['1', '2']}},
      },
    });

    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer />,
      initializationObj.routerContext,
      initializationObj.organization
    );

    await tick(); // reflux tick

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);
    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with default values when there are no query params in URL', function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {}},
      },
    });

    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer />,
      initializationObj.routerContext,
      initializationObj.organization
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
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {
          query: {project: ['2']},
        },
      },
    });

    OrganizationStore.onUpdate(initializationObj.organization);

    wrapper = mountWithThemeAndOrg(
      <PageFiltersContainer hideGlobalHeader />,
      initializationObj.routerContext,
      initializationObj.organization
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
    it('does not do anything while organization is switching in single project', function () {
      const initialData = initializeOrg({
        organization: {slug: 'old-org-slug'},
        router: {
          // we need this to be set to make sure org in context is same as
          // current org in URL
          params: {orgId: 'org-slug'},
          location: {pathname: '/test', query: {project: ['1']}},
        },
      });

      MockApiClient.addMockResponse({
        url: '/organizations/old-org-slug/projects/',
        body: [],
      });

      ProjectsStore.reset();

      // This can happen when you switch organization so params.orgId !== the
      // current org in context In this case params.orgId = 'org-slug'
      wrapper = mountWithThemeAndOrg(
        <PageFiltersContainer />,
        initialData.routerContext,
        initialData.organization
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
      OrganizationStore.onUpdate(updatedOrganization);
      wrapper.setContext({
        organization: updatedOrganization,
        location: {query: {}},
        router: {
          ...initialData.router,
          location: {pathname: '/test', query: {}},
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
          location: {pathname: '/test', query: {project: ['1', '2']}},
        },
      });

      wrapper = mountWithThemeAndOrg(
        <PageFiltersContainer />,
        initializationObj.routerContext,
        initializationObj.organization
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['1']},
        })
      );
    });

    it('selects first project if none (i.e. all) is requested', function () {
      const project = TestStubs.Project({id: '3'});
      const org = TestStubs.Organization({projects: [project]});

      ProjectsStore.loadInitialData(org.projects);

      const initializationObj = initializeOrg({
        organization: org,
        router: {
          params: {orgId: 'org-slug'},
          location: {pathname: '/test', query: {}},
        },
      });

      wrapper = mountWithThemeAndOrg(
        <PageFiltersContainer />,
        initializationObj.routerContext,
        initializationObj.organization
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['3']},
        })
      );
    });
  });

  describe('forceProject selection mode', function () {
    const initialData = initializeOrg({
      organization: {features: ['global-views']},
      projects: [
        {id: 1, slug: 'staging-project', environments: ['staging']},
        {id: 2, slug: 'prod-project', environments: ['prod']},
      ],
      router: {
        location: {pathname: '/test', query: {}},
      },
    });

    beforeEach(async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });

      ProjectsStore.loadInitialData(initialData.projects);

      wrapper = mountWithThemeAndOrg(
        <PageFiltersContainer
          shouldForceProject
          forceProject={initialData.projects[0]}
          showIssueStreamLink
        />,
        initialData.routerContext,
        initialData.organization
      );

      await tick();
      wrapper.update();
    });

    it('replaces URL with project', function () {
      expect(initialData.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['1']},
        })
      );
    });
  });

  describe('skipInitializeUrlParams', function () {
    const initialData = initializeOrg({
      organization,
      projects: [{id: 1, slug: 'staging-project', environments: ['staging']}],
      router: {
        location: {pathname: '/test', query: {}},
      },
    });

    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      ProjectsStore.loadInitialData(initialData.projects);
    });

    it('does not add forced project to URL', async function () {
      wrapper = mountWithThemeAndOrg(
        <PageFiltersContainer
          skipInitializeUrlParams
          shouldForceProject
          forceProject={initialData.projects[0]}
          showIssueStreamLink
        />,
        initialData.routerContext,
        initialData.organization
      );
      await tick();
      wrapper.update();

      expect(router.replace).not.toHaveBeenCalled();
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
          location: {pathname: '/test', query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      const createWrapper = props => {
        wrapper = mountWithThemeAndOrg(
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            {...props}
          />,
          initialData.routerContext,
          initialData.organization
        );
        return wrapper;
      };

      beforeEach(function () {
        ProjectsStore.loadInitialData(initialData.projects);

        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('uses first project in org projects when mounting', function () {
        createWrapper();

        // Projects are returned in sorted slug order, so `prod-project` would
        // be the first project
        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
          query: {cursor: undefined, environment: [], project: ['2']},
        });
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', function () {
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
          pathname: '/test',
          query: {environment: [], project: ['1']},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', function () {
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

      it('appends projectId to URL when mounted with `forceProject`', function () {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
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
          location: {pathname: '/test', query: {statsPeriod: '90d'}},
          params: {orgId: 'org-slug'},
        },
      });
      ProjectsStore.loadInitialData(initialData.projects);

      const createWrapper = props => {
        wrapper = mountWithThemeAndOrg(
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            {...props}
          />,
          initialData.routerContext,
          initialData.organization
        );
        return wrapper;
      };

      beforeEach(function () {
        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('appends projectId to URL when mounted with `forceProject`', function () {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
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
          location: {pathname: '/test', query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      const createWrapper = (props, ctx) => {
        wrapper = mountWithThemeAndOrg(
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            {...props}
          />,
          {
            ...initialData.routerContext,
            ...ctx,
          },
          initialData.organization
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

      it('does not append projectId to URL when `loadingProjects` changes and finishes loading', function () {
        ProjectsStore.reset();

        createWrapper();

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        wrapper.setProps({
          forceProject: initialData.projects[1],
        });

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', function () {
        ProjectsStore.reset();

        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        wrapper.setProps({
          forceProject: initialData.projects[1],
        });

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
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
});
