import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import * as globalActions from 'sentry/actionCreators/pageFilters';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import localStorage from 'sentry/utils/localStorage';

describe('PageFiltersContainer', () => {
  const organization = OrganizationFixture();
  const projects = [
    ProjectFixture({id: '1', slug: 'project-1'}),
    ProjectFixture({id: '2', slug: 'project-2'}),
    ProjectFixture({id: '3', slug: 'project-3', environments: ['prod', 'staging']}),
  ];

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
    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/diff-org/test/', query: {}},
        route: '/organizations/:orgId/test/',
      },
    });

    // Router location should remain unchanged
    expect(router.location.pathname).toBe('/organizations/diff-org/test/');
    expect(router.location.query).toEqual({});
  });

  it('does not replace URL with values from store when mounted with no query params', () => {
    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/test/', query: {}},
        route: '/organizations/:orgId/test/',
      },
    });

    // Router location should remain unchanged
    expect(router.location.pathname).toBe('/organizations/org-slug/test/');
    expect(router.location.query).toEqual({});
  });

  it('only updates GlobalSelection store when mounted with query params', async () => {
    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/test/',
          query: {statsPeriod: '7d'},
        },
        route: '/organizations/:orgId/test/',
      },
    });

    // Router location should remain unchanged (no push)
    expect(router.location.pathname).toBe('/organizations/org-slug/test/');

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
    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/test/',
          query: {environment: 'prod'},
        },
        route: '/organizations/:orgId/test/',
      },
    });

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

    // Not called because of the default date - location unchanged
    expect(router.location.query).toEqual({environment: 'prod'});
  });

  it('updates GlobalSelection store with empty dates in URL', async () => {
    render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/test/', query: {}},
        route: '/organizations/:orgId/test/',
      },
    });

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
    render(<PageFiltersContainer showAbsolute={false} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/test/',
          query: {
            start: '2020-05-05T07:26:53.000',
            end: '2020-05-05T09:19:12.000',
          },
        },
        route: '/organizations/:orgId/test/',
      },
    });

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
    const {rerender} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/test/',
          query: {statsPeriod: '7d'},
        },
        route: '/organizations/:orgId/test/',
      },
    });

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

  it('loads from local storage when no URL parameters and filters are pinned', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() =>
      JSON.stringify({
        projects: [3],
        environments: ['staging'],
        pinnedFilters: ['projects', 'environments'],
      })
    );

    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/test/', query: {}},
        route: '/organizations/:orgId/test/',
      },
    });

    await waitFor(() => {
      expect(PageFiltersStore.getState().selection.projects).toEqual([3]);
    });

    // Since these are coming from local storage, router should be updated
    await waitFor(() => {
      expect(router.location.query).toEqual({
        environment: 'staging',
        project: '3',
      });
    });
  });

  it('does not load from local storage when there are URL params', () => {
    jest
      .spyOn(localStorage, 'getItem')
      .mockImplementation(() =>
        JSON.stringify({projects: [3], environments: ['staging']})
      );

    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/test/',
          query: {project: ['1', '2']},
        },
        route: '/organizations/:orgId/test/',
      },
    });

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);

    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(router.location.query).toEqual({project: ['1', '2']});
  });

  it('updates store when there are query params in URL', () => {
    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/test/',
          query: {project: ['1', '2']},
        },
        route: '/organizations/:orgId/test/',
      },
    });

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);

    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(router.location.query).toEqual({project: ['1', '2']});
  });

  it('updates store with default values when there are no query params in URL', () => {
    const {router} = render(<PageFiltersContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/test/', query: {}},
        route: '/organizations/:orgId/test/',
      },
    });

    // Router does not update because params have not changed
    expect(router.location.query).toEqual({});
  });

  it('updates store with desynced values when url params do not match local storage', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() =>
      JSON.stringify({
        projects: [1],
        pinnedFilters: ['projects'],
      })
    );

    const testOrg = OrganizationFixture();
    OrganizationStore.onUpdate(testOrg);

    render(<PageFiltersContainer />, {
      organization: testOrg,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/test/',
          query: {project: ['2']},
        },
        route: '/organizations/:orgId/test/',
      },
    });

    // reflux tick
    expect(PageFiltersStore.getState().selection.projects).toEqual([2]);

    // Wait for desynced filters to update
    await waitFor(() =>
      expect(PageFiltersStore.getState().desyncedFilters).toEqual(new Set(['projects']))
    );
  });

  it('does not update local storage when disablePersistence is true', async () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem');

    const mockRouter = RouterFixture({
      location: {pathname: '/organizations/org-slug/test/', query: {project: []}},
    });

    render(<PageFiltersContainer disablePersistence />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/test/', query: {project: []}},
        route: '/organizations/:orgId/test/',
      },
    });

    await act(async () => {
      globalActions.updateProjects([1], mockRouter, {save: true});

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
    const forceProjectProjects = [
      ProjectFixture({id: '1', slug: 'staging-project', environments: ['staging']}),
      ProjectFixture({id: '2', slug: 'prod-project', environments: ['prod']}),
    ];

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });

      ProjectsStore.loadInitialData(forceProjectProjects);
    });

    it('replaces URL with project', async () => {
      const {router} = render(
        <PageFiltersContainer
          shouldForceProject
          forceProject={forceProjectProjects[0]}
        />,
        {
          organization,
          initialRouterConfig: {
            location: {pathname: '/test/', query: {}},
            route: '/test/',
          },
        }
      );

      await waitFor(() => {
        expect(router.location.query).toEqual({project: '1'});
      });
    });
  });

  describe('maxPickableDays param', () => {
    it('applies maxPickableDays if the query parms exceed it', async () => {
      render(<PageFiltersContainer maxPickableDays={7} />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/test/',
            query: {statsPeriod: '14d'},
          },
          route: '/organizations/:orgId/test/',
        },
      });

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

    it('does not use maxPickableDays if the query parms do not exceed it', async () => {
      const {router} = render(<PageFiltersContainer maxPickableDays={7} />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/test/',
            query: {statsPeriod: '3d'},
          },
          route: '/organizations/:orgId/test/',
        },
      });

      // Router location should remain unchanged (no push)
      expect(router.location.query).toEqual({statsPeriod: '3d'});

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

      // Still no push
      expect(router.location.query).toEqual({statsPeriod: '3d'});
    });

    it('applies maxPickableDays if the query parms are in the past', async () => {
      render(<PageFiltersContainer maxPickableDays={7} />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/test/',
            query: {
              start: moment().subtract(21, 'days').format('YYYY-MM-DDTHH:mm:ss'),
              end: moment().subtract(20, 'days').format('YYYY-MM-DDTHH:mm:ss'),
            },
          },
          route: '/organizations/:orgId/test/',
        },
      });

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
  });

  describe('skipInitializeUrlParams', () => {
    const skipInitProjects = [
      ProjectFixture({id: '1', slug: 'staging-project', environments: ['staging']}),
    ];

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      ProjectsStore.loadInitialData(skipInitProjects);
    });

    it('does not add forced project to URL', async () => {
      const {router} = render(
        <PageFiltersContainer
          skipInitializeUrlParams
          shouldForceProject
          forceProject={skipInitProjects[0]}
        />,
        {
          organization,
          initialRouterConfig: {
            location: {pathname: '/test/', query: {}},
            route: '/test/',
          },
        }
      );

      // Needed to make sure things update
      await act(tick);

      // Router location should remain unchanged
      expect(router.location.query).toEqual({});
    });
  });

  describe('multi-project mode', () => {
    describe('without existing URL params', () => {
      const multiProjectOrg = OrganizationFixture();
      const multiProjectProjects = [
        ProjectFixture({id: '0', slug: 'random project', isMember: true}),
        ProjectFixture({id: '1', slug: 'staging-project', environments: ['staging']}),
        ProjectFixture({id: '2', slug: 'prod-project', environments: ['prod']}),
      ];

      function renderForGlobalView(
        props: Record<string, unknown> = {},
        locationQuery: Record<string, string | number | string[]> = {}
      ) {
        const result = render(<PageFiltersContainer {...props} />, {
          organization: multiProjectOrg,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/test/',
              query: locationQuery,
            },
            route: '/organizations/:orgId/test/',
          },
        });

        const rerender = (newProps: Record<string, unknown>) =>
          result.rerender(<PageFiltersContainer {...props} {...newProps} />);

        return {...result, rerender};
      }

      beforeEach(() => {
        ProjectsStore.loadInitialData(multiProjectProjects);
      });

      it('does not use first project in org projects when mounting (and without localStorage data)', () => {
        const {router} = renderForGlobalView();
        // Router location should remain unchanged
        expect(router.location.query).toEqual({});
      });

      it('does not append projectId to URL when `loadingProjects` changes and finishes loading', () => {
        ProjectsStore.reset();

        const {router, rerender} = renderForGlobalView();

        // load the projects
        act(() => ProjectsStore.loadInitialData(multiProjectProjects));

        rerender({forceProject: multiProjectProjects[1]});

        // Router location should remain unchanged
        expect(router.location.query).toEqual({});
      });

      it('updates store when `forceProject` becomes available (async)', async () => {
        ProjectsStore.reset();

        // forceProject generally starts undefined
        const {rerender} = renderForGlobalView({shouldForceProject: true});

        rerender({forceProject: multiProjectProjects[1]});

        // load the projects
        act(() => ProjectsStore.loadInitialData(multiProjectProjects));

        // Store is updated with the forced project
        await waitFor(() => {
          expect(PageFiltersStore.getState().selection.projects).toEqual([1]);
        });
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', () => {
        // forceProject generally starts undefined
        const {router, rerender} = renderForGlobalView(
          {shouldForceProject: true},
          {project: '2'}
        );

        rerender({forceProject: multiProjectProjects[1]});

        // Router location should remain unchanged
        expect(router.location.query).toEqual({project: '2'});
      });
    });
  });
});
