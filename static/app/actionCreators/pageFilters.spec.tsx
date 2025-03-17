import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import {
  initializeUrlState,
  revertToPinnedFilters,
  updateDateTime,
  updateEnvironments,
  updatePersistence,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import * as PageFilterPersistence from 'sentry/components/organizations/pageFilters/persistence';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import localStorage from 'sentry/utils/localStorage';

jest.mock('sentry/utils/localStorage');

const {organization, projects} = initializeOrg({
  projects: [
    {id: '1', slug: 'project-1', environments: ['prod', 'staging']},
    {id: '2', slug: 'project-2', environments: ['prod', 'stage']},
  ],
});

describe('PageFilters ActionCreators', function () {
  beforeEach(function () {
    jest.spyOn(PageFiltersStore, 'updateProjects');
    jest.spyOn(PageFiltersStore, 'onInitializeUrlState').mockImplementation();
    jest.clearAllMocks();
  });

  describe('initializeUrlState', function () {
    let router: ReturnType<typeof RouterFixture>;
    const key = `global-selection:${organization.slug}`;

    beforeEach(() => {
      router = RouterFixture();
      localStorage.setItem(
        key,
        JSON.stringify({
          environments: [],
          projects: [1],
        })
      );
    });

    it('loads from local storage when no query params and filters are pinned', function () {
      localStorage.setItem(
        key,
        JSON.stringify({
          environments: [],
          projects: [1],
          pinnedFilters: ['projects', 'environments'],
        })
      );
      initializeUrlState({
        organization,
        queryParams: {},
        router,
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
      });

      expect(localStorage.getItem).toHaveBeenCalledWith(
        `global-selection:${organization.slug}`
      );
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [1],
        }),
        new Set(['projects', 'environments']),
        true
      );
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: [],
            project: ['1'],
          },
        })
      );
    });

    it('does not load from local storage when no query params and `skipLoadLastUsed` is true', function () {
      jest.spyOn(localStorage, 'getItem');
      initializeUrlState({
        organization,
        queryParams: {},
        skipLoadLastUsed: true,
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        router,
      });

      expect(localStorage.getItem).not.toHaveBeenCalled();
    });

    it('does not update local storage (persist) when `shouldPersist` is false', async function () {
      jest.clearAllMocks();
      jest.spyOn(localStorage, 'getItem').mockReturnValueOnce(
        JSON.stringify({
          environments: [],
          projects: [],
          pinnedFilters: ['projects'],
        })
      );

      initializeUrlState({
        organization,
        queryParams: {},
        shouldPersist: false,
        router,
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [],
        }),
        new Set(['projects']),
        false
      );

      // `onInitializeUrlState` is being spied on, so PageFiltersStore wasn't actually
      // updated. We need to call `updatePersistence` manually.
      updatePersistence(false);

      await act(async () => {
        // Filters shouldn't persist even when `save` is true
        updateProjects([1], router, {save: true});

        // Page filter values are asynchronously persisted to local storage after a tick,
        // so we need to wait before checking for commits to local storage
        await tick();
      });

      // New value wasn't committed to local storage
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('does not change dates with no query params or defaultSelection', function () {
      initializeUrlState({
        organization,
        queryParams: {
          project: '1',
        },
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        router,
      });
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          datetime: {
            start: null,
            end: null,
            period: '14d',
            utc: null,
          },
        }),
        new Set(),
        true
      );
    });

    it('does changes to default dates with defaultSelection and no query params', function () {
      initializeUrlState({
        organization,
        queryParams: {
          project: '1',
        },
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        defaultSelection: {
          datetime: {
            period: '3h',
            utc: null,
            start: null,
            end: null,
          },
        },
        router,
      });
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          datetime: {
            start: null,
            end: null,
            period: '3h',
            utc: null,
          },
        }),
        new Set(),
        true
      );
    });

    it('uses query params statsPeriod over defaults', function () {
      initializeUrlState({
        organization,
        queryParams: {
          statsPeriod: '1h',
          project: '1',
        },
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        defaultSelection: {
          datetime: {
            period: '24h',
            utc: null,
            start: null,
            end: null,
          },
        },
        router,
      });
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            cursor: undefined,
            project: ['1'],
            environment: [],
            statsPeriod: '1h',
          },
        })
      );
    });

    it('uses absolute dates over defaults', function () {
      initializeUrlState({
        organization,
        queryParams: {
          start: '2020-03-22T00:53:38',
          end: '2020-04-21T00:53:38',
          project: '1',
        },
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        defaultSelection: {
          datetime: {
            period: '24h',
            utc: null,
            start: null,
            end: null,
          },
        },
        router,
      });
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            cursor: undefined,
            project: ['1'],
            environment: [],
            start: '2020-03-22T00:53:38',
            end: '2020-04-21T00:53:38',
          },
        })
      );
    });

    it('does not load from local storage when there are query params', function () {
      initializeUrlState({
        organization,
        queryParams: {
          project: '1',
        },
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        router,
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        {
          datetime: {
            start: null,
            end: null,
            period: '14d',
            utc: null,
          },
          projects: [1],
          environments: [],
        },
        new Set(),
        true
      );
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: [],
            project: ['1'],
          },
        })
      );
    });

    it('does not invalidate all projects from query params', function () {
      initializeUrlState({
        organization,
        queryParams: {
          project: '-1',
        },
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        router,
      });
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        {
          datetime: {
            start: null,
            end: null,
            period: '14d',
            utc: null,
          },
          projects: [-1],
          environments: [],
        },
        new Set(),
        true
      );
    });

    it('does invalidate all projects from query params if forced into single project', function () {
      initializeUrlState({
        organization,
        queryParams: {
          project: '-1',
        },
        memberProjects: projects,
        nonMemberProjects: [],
        // User does not have access to global views
        shouldEnforceSingleProject: true,
        router,
      });
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        {
          datetime: {
            start: null,
            end: null,
            period: '14d',
            utc: null,
          },
          projects: [1],
          environments: [],
        },
        new Set(),
        true
      );
    });

    it('does not add non-pinned filters to query for pages with new page filters', function () {
      // Mock storage to have a saved value
      const pageFilterStorageMock = jest
        .spyOn(PageFilterPersistence, 'getPageFilterStorage')
        .mockReturnValueOnce({
          state: {
            project: [1],
            environment: [],
            start: null,
            end: null,
            period: '14d',
            utc: null,
          },
          pinnedFilters: new Set(),
        });

      // Initialize state with a page that shouldn't restore from local storage
      initializeUrlState({
        organization,
        queryParams: {},
        router,
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
      });

      // Confirm that query params are not restored from local storage
      expect(router.replace).not.toHaveBeenCalled();

      pageFilterStorageMock.mockRestore();
    });

    it('uses pinned filters for pages with new page filters', function () {
      // Mock storage to have a saved/pinned value
      const pageFilterStorageMock = jest
        .spyOn(PageFilterPersistence, 'getPageFilterStorage')
        .mockReturnValueOnce({
          state: {
            project: [1],
            environment: ['prod'],
            start: null,
            end: null,
            period: '7d',
            utc: null,
          },
          pinnedFilters: new Set(['environments', 'datetime', 'projects']),
        });

      // Initialize state with a page that uses pinned filters
      initializeUrlState({
        organization,
        queryParams: {},
        router,
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
      });

      // Confirm that only environment is restored from local storage
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: ['prod'],
            project: ['1'],
            statsPeriod: '7d',
          },
        })
      );

      pageFilterStorageMock.mockRestore();
    });

    it('retrieves filters from a separate key when storageNamespace is provided', function () {
      const starfishKey = `global-selection:starfish:${organization.slug}`;
      localStorage.setItem(
        starfishKey,
        JSON.stringify({
          environments: [],
          projects: [1],
          pinnedFilters: ['projects', 'environments'],
        })
      );

      initializeUrlState({
        organization,
        queryParams: {},
        router,
        memberProjects: projects,
        nonMemberProjects: [],
        shouldEnforceSingleProject: false,
        storageNamespace: 'starfish',
      });

      expect(localStorage.getItem).toHaveBeenCalledWith(starfishKey);
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [1],
        }),
        new Set(['projects', 'environments']),
        true
      );
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: [],
            project: ['1'],
          },
        })
      );
    });
  });

  describe('updateProjects()', function () {
    it('updates', function () {
      updateProjects([1, 2]);
      expect(PageFiltersStore.updateProjects).toHaveBeenCalledWith([1, 2], null);
    });

    it('updates history when queries are different', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {project: '2'},
        },
      });
      // this can be passed w/ `project` as an array (e.g. multiple projects being selected)
      // however react-router will treat it as a string if there is only one param
      updateProjects([1], router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {project: ['1']},
      });
    });
    it('does not update history when queries are the same', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {project: '1'},
        },
      });
      // this can be passed w/ `project` as an array (e.g. multiple projects
      // being selected) however react-router will treat it as a string if
      // there is only one param
      updateProjects([1], router);

      expect(router.push).not.toHaveBeenCalled();
    });

    it('updates history when queries are different with replace', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {project: '2'},
        },
      });
      updateProjects([1], router, {replace: true});

      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {project: ['1']},
      });
    });

    it('does not update history when queries are the same with replace', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {project: '1'},
        },
      });
      updateProjects([1], router, {replace: true});

      expect(router.replace).not.toHaveBeenCalled();
    });

    it('does not override an absolute date selection', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {project: '1', start: '2020-03-22T00:53:38', end: '2020-04-21T00:53:38'},
        },
      });
      updateProjects([2], router, {replace: true});

      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {project: ['2'], start: '2020-03-22T00:53:38', end: '2020-04-21T00:53:38'},
      });
    });
  });

  describe('updateEnvironments()', function () {
    it('updates single', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {environment: 'test'},
        },
      });
      updateEnvironments(['new-env'], router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {environment: ['new-env']},
      });
    });

    it('updates multiple', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {environment: 'test'},
        },
      });
      updateEnvironments(['new-env', 'another-env'], router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {environment: ['new-env', 'another-env']},
      });
    });

    it('removes environment', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {environment: 'test'},
        },
      });
      updateEnvironments(null, router);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {},
      });
    });

    it('does not override an absolute date selection', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {
            environment: 'test',
            start: '2020-03-22T00:53:38',
            end: '2020-04-21T00:53:38',
          },
        },
      });
      updateEnvironments(['new-env'], router, {replace: true});

      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {
          environment: ['new-env'],
          start: '2020-03-22T00:53:38',
          end: '2020-04-21T00:53:38',
        },
      });
    });
  });

  describe('updateDateTime()', function () {
    it('updates statsPeriod when there is no existing stats period', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {},
        },
      });
      updateDateTime({period: '24h'}, router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {
          statsPeriod: '24h',
        },
      });
    });

    it('updates statsPeriod when there is an existing stats period', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {statsPeriod: '14d'},
        },
      });
      updateDateTime({period: '24h'}, router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {
          statsPeriod: '24h',
        },
      });
    });

    it('changes to absolute date', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {statsPeriod: '24h'},
        },
      });
      updateDateTime({start: '2020-03-22T00:53:38', end: '2020-04-21T00:53:38'}, router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {
          start: '2020-03-22T00:53:38',
          end: '2020-04-21T00:53:38',
        },
      });
    });
  });

  describe('revertToPinnedFilters()', function () {
    it('reverts all filters that are desynced from localStorage', function () {
      const router = RouterFixture({
        location: {
          pathname: '/test/',
          query: {},
        },
      });
      // Mock storage to have a saved value
      const pageFilterStorageMock = jest
        .spyOn(PageFilterPersistence, 'getPageFilterStorage')
        .mockReturnValueOnce({
          state: {
            project: [1],
            environment: [],
            start: null,
            end: null,
            period: '14d',
            utc: null,
          },
          pinnedFilters: new Set(['projects', 'environments', 'datetime']),
        });

      PageFiltersStore.onInitializeUrlState(
        {
          projects: [2],
          environments: ['prod'],
          datetime: {
            start: null,
            end: null,
            period: '1d',
            utc: null,
          },
        },
        new Set()
      );
      PageFiltersStore.updateDesyncedFilters(
        new Set(['projects', 'environments', 'datetime'])
      );

      revertToPinnedFilters('org-slug', router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {
          environment: [],
          project: ['1'],
          statsPeriod: '14d',
        },
      });

      pageFilterStorageMock.mockRestore();
    });
  });
});
