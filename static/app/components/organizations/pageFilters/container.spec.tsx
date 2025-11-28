import moment from 'moment-timezone';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import * as globalActions from 'sentry/actionCreators/pageFilters';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import localStorage from 'sentry/utils/localStorage';

const changeQuery = (router: any, query: any) => ({
  ...router,
  location: {
    ...router.location,
    query,
  },
});

function renderComponent(component: any, router: any, organization: any) {
  return render(component, {
    router,
    organization,
    deprecatedRouterMocks: true,
  });
}

describe('PageFiltersContainer', () => {
  const {organization, projects, router} = initializeOrg({
    organization: {},
    projects: [
      {
        id: '1',
        slug: 'project-1',
      },
      {
        id: '2',
        slug: 'project-2',
      },
      {
        id: '3',
        slug: 'project-3',
        environments: ['prod', 'staging'],
      },
    ],
    router: {
      location: {pathname: '/test', query: {}},
      params: {orgId: 'org-slug'},
    },
  });

  beforeAll(() => {
    jest.spyOn(globalActions, 'updateDateTime');
    jest.spyOn(globalActions, 'updateEnvironments');
    jest.spyOn(globalActions, 'updateProjects');
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData(projects);
    OrganizationStore.onUpdate(organization);
    OrganizationsStore.addOrReplace(organization);

    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    PageFiltersStore.reset();
  });

  it('does not update router if org in URL params is different than org in context/props', () => {
    renderComponent(
      <PageFiltersContainer />,
      {
        router: {...router, params: {orgId: 'diff-org'}},
      },
      organization
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not replace URL with values from store when mounted with no query params', () => {
    renderComponent(<PageFiltersContainer />, router, organization);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('only updates GlobalSelection store when mounted with query params', async () => {
    renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {statsPeriod: '7d'}),
      organization
    );

    expect(router.push).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(PageFiltersStore.getState().selection).toEqual({
        datetime: {
          period: '7d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      })
    );
  });

  it('updates GlobalSelection store with default period', async () => {
    renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {
        environment: 'prod',
      }),
      organization
    );

    await waitFor(() =>
      expect(PageFiltersStore.getState()).toEqual({
        isReady: true,
        desyncedFilters: new Set(),
        pinnedFilters: new Set(['projects', 'environments', 'datetime']),
        shouldPersist: true,
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
      })
    );

    // Not called because of the default date
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('updates GlobalSelection store with empty dates in URL', async () => {
    renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {
        statsPeriod: null,
      }),
      organization
    );

    await waitFor(() =>
      expect(PageFiltersStore.getState()).toEqual({
        isReady: true,
        desyncedFilters: new Set(),
        pinnedFilters: new Set(['projects', 'environments', 'datetime']),
        shouldPersist: true,
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
      })
    );
  });

  it('resets start&end if showAbsolute prop is false', async () => {
    renderComponent(
      <PageFiltersContainer showAbsolute={false} />,
      changeQuery(router, {
        start: '2020-05-05T07:26:53.000',
        end: '2020-05-05T09:19:12.000',
      }),
      organization
    );

    await waitFor(() =>
      expect(PageFiltersStore.getState()).toEqual({
        isReady: true,
        desyncedFilters: new Set(),
        pinnedFilters: new Set(['projects', 'environments', 'datetime']),
        shouldPersist: true,
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
      })
    );
  });

  /**
   * I don't think this test is really applicable anymore
   */
  it('does not update store if url params have not changed', async () => {
    const {rerender} = renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {statsPeriod: '7d'}),
      organization
    );

    jest.mocked(globalActions.updateDateTime).mockClear();
    jest.mocked(globalActions.updateProjects).mockClear();
    jest.mocked(globalActions.updateEnvironments).mockClear();

    rerender(<PageFiltersContainer />);

    await waitFor(() => {
      expect(globalActions.updateDateTime).not.toHaveBeenCalled();
    });
    expect(globalActions.updateProjects).not.toHaveBeenCalled();
    expect(globalActions.updateEnvironments).not.toHaveBeenCalled();

    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(['projects', 'environments', 'datetime']),
      shouldPersist: true,
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

  it('loads from local storage when no URL parameters and filters are pinned', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() =>
      JSON.stringify({
        projects: [3],
        environments: ['staging'],
        pinnedFilters: ['projects', 'environments'],
      })
    );
    const initializationObj = initializeOrg({
      organization: {},
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

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

  it('does not load from local storage when there are URL params', () => {
    jest
      .spyOn(localStorage, 'getItem')
      .mockImplementation(() =>
        JSON.stringify({projects: [3], environments: ['staging']})
      );

    const initializationObj = initializeOrg({
      organization: {},
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {project: ['1', '2']}},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);

    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store when there are query params in URL', () => {
    const initializationObj = initializeOrg({
      organization: {},
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {project: ['1', '2']}},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);

    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with default values when there are no query params in URL', () => {
    const initializationObj = initializeOrg({
      organization: {},
      projects: [ProjectFixture({id: '1'}), ProjectFixture({id: '2'})],
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {}},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    // Router does not update because params have not changed
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with desynced values when url params do not match local storage', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() =>
      JSON.stringify({
        projects: [1],
        pinnedFilters: ['projects'],
      })
    );

    const initializationObj = initializeOrg({
      organization: {},
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

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    // reflux tick
    expect(PageFiltersStore.getState().selection.projects).toEqual([2]);

    // Wait for desynced filters to update
    await waitFor(() =>
      expect(PageFiltersStore.getState().desyncedFilters).toEqual(new Set(['projects']))
    );
  });

  it('does not update local storage when disablePersistence is true', async () => {
    const initializationObj = initializeOrg({
      organization: {},
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {project: []}},
      },
    });

    const spy = jest.spyOn(Storage.prototype, 'setItem');

    renderComponent(
      <PageFiltersContainer disablePersistence />,
      initializationObj.router,
      initializationObj.organization
    );

    await act(async () => {
      globalActions.updateProjects([1], initializationObj.router, {save: true});

      // page filter values are asynchronously persisted to local storage after a tick,
      // so we need to wait before checking for commits to local storage
      await tick();
    });

    // Store value was updated
    expect(PageFiltersStore.getState().selection.projects).toEqual([1]);

    // But local storage wasn't updated
    expect(spy).not.toHaveBeenCalled();
  });

  describe('forceProject selection mode', () => {
    const initialData = initializeOrg({
      organization: {},
      projects: [
        {id: '1', slug: 'staging-project', environments: ['staging']},
        {id: '2', slug: 'prod-project', environments: ['prod']},
      ],
      router: {
        location: {pathname: '/test', query: {}},
      },
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });

      ProjectsStore.loadInitialData(initialData.projects);
    });

    it('replaces URL with project', () => {
      renderComponent(
        <PageFiltersContainer
          shouldForceProject
          forceProject={initialData.projects[0]}
        />,
        initialData.router,
        initialData.organization
      );

      expect(initialData.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['1']},
        })
      );
    });
  });

  describe('maxPickableDays param', () => {
    it('applies maxPickableDays if the query parms exceed it', async () => {
      renderComponent(
        <PageFiltersContainer maxPickableDays={7} />,
        changeQuery(router, {statsPeriod: '14d'}),
        organization
      );

      expect(router.push).not.toHaveBeenCalled();

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection).toEqual({
          datetime: {
            period: '7d',
            utc: null,
            start: null,
            end: null,
          },
          environments: [],
          projects: [],
        })
      );

      expect(router.push).not.toHaveBeenCalled();
    });

    it('does not use maxPickableDays if the query parms do not exceed it', async () => {
      renderComponent(
        <PageFiltersContainer maxPickableDays={7} />,
        changeQuery(router, {statsPeriod: '3d'}),
        organization
      );

      expect(router.push).not.toHaveBeenCalled();

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection).toEqual({
          datetime: {
            period: '3d',
            utc: null,
            start: null,
            end: null,
          },
          environments: [],
          projects: [],
        })
      );

      expect(router.push).not.toHaveBeenCalled();
    });

    it('applies maxPickableDays if the query parms are in the past', async () => {
      const start = moment().subtract(21, 'days').format('YYYY-MM-DDTHH:mm:ss');
      const end = moment().subtract(20, 'days').format('YYYY-MM-DDTHH:mm:ss');
      renderComponent(
        <PageFiltersContainer maxPickableDays={7} />,
        changeQuery(router, {start, end}),
        organization
      );

      expect(router.push).not.toHaveBeenCalled();

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection).toEqual({
          datetime: {
            period: '7d',
            utc: null,
            start: null,
            end: null,
          },
          environments: [],
          projects: [],
        })
      );

      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('skipInitializeUrlParams', () => {
    const initialData = initializeOrg({
      organization,
      projects: [{id: '1', slug: 'staging-project', environments: ['staging']}],
      router: {
        location: {pathname: '/test', query: {}},
      },
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      ProjectsStore.loadInitialData(initialData.projects);
    });

    it('does not add forced project to URL', async () => {
      renderComponent(
        <PageFiltersContainer
          skipInitializeUrlParams
          shouldForceProject
          forceProject={initialData.projects[0]}
        />,
        initialData.router,
        initialData.organization
      );

      // Needed to make sure things update
      await act(tick);

      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe('multi-project mode', () => {
    describe('without existing URL params', () => {
      const initialData = initializeOrg({
        organization: {},
        projects: [
          {id: '0', slug: 'random project', isMember: true},
          {id: '1', slug: 'staging-project', environments: ['staging']},
          {id: '2', slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {pathname: '/test', query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      function getComponentForGlobalView(props: any) {
        return (
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            {...props}
          />
        );
      }

      function renderForGlobalView(props = {}, ctx = {}) {
        const result = renderComponent(
          getComponentForGlobalView(props),
          {
            ...initialData.router,
            ...ctx,
          },
          initialData.organization
        );

        const rerender = (newProps: any) =>
          result.rerender(getComponentForGlobalView({...props, ...newProps}));

        return {...result, rerender};
      }

      beforeEach(() => {
        ProjectsStore.loadInitialData(initialData.projects);

        jest.mocked(initialData.router.push).mockClear();
        jest.mocked(initialData.router.replace).mockClear();
      });

      it('does not use first project in org projects when mounting (and without localStorage data)', () => {
        renderForGlobalView();
        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('does not append projectId to URL when `loadingProjects` changes and finishes loading', () => {
        ProjectsStore.reset();

        const {rerender} = renderForGlobalView();

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        rerender({forceProject: initialData.projects[1]});

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', () => {
        ProjectsStore.reset();

        // forceProject generally starts undefined
        const {rerender} = renderForGlobalView({shouldForceProject: true});

        rerender({forceProject: initialData.projects[1]});

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
          query: {environment: [], project: ['1']},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', () => {
        // forceProject generally starts undefined
        const {rerender} = renderForGlobalView(
          {shouldForceProject: true},
          changeQuery(initialData.router, {project: 2})
        );

        rerender({forceProject: initialData.projects[1]});

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });
    });
  });
});
