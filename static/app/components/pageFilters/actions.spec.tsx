import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import {
  initializeUrlState,
  updateDateTime,
  updateEnvironments,
  updatePersistence,
  updateProjects,
} from 'sentry/components/pageFilters/actions';
import * as PageFilterPersistence from 'sentry/components/pageFilters/persistence';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {localStorageWrapper} from 'sentry/utils/localStorage';

jest.mock('sentry/utils/localStorage');

const {organization, projects} = initializeOrg({
  projects: [
    {id: '1', slug: 'project-1', environments: ['prod', 'staging']},
    {id: '2', slug: 'project-2', environments: ['prod', 'stage']},
  ],
});

describe('PageFilters ActionCreators', () => {
  beforeEach(() => {
    jest.spyOn(PageFiltersStore, 'updateProjects');
    jest.spyOn(PageFiltersStore, 'onInitializeUrlState').mockImplementation();
    jest.clearAllMocks();
    OrganizationStore.onUpdate(organization, {replace: true});
    ConfigStore.set('user', UserFixture());
  });

  describe('initializeUrlState', () => {
    let router: ReturnType<typeof RouterFixture>;
    let navigate: jest.Mock;
    const key = `global-selection:${organization.slug}`;

    beforeEach(() => {
      router = RouterFixture();
      navigate = jest.fn();
      localStorageWrapper.setItem(
        key,
        JSON.stringify({
          environments: [],
          projects: [1],
        })
      );
    });

    it('loads from local storage when no query params and filters are pinned', () => {
      localStorageWrapper.setItem(
        key,
        JSON.stringify({
          environments: [],
          projects: [1],
          pinnedFilters: ['projects', 'environments'],
        })
      );
      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
      });

      expect(localStorageWrapper.getItem).toHaveBeenCalledWith(
        `global-selection:${organization.slug}`
      );
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [1],
        }),
        true
      );
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: [],
            project: ['1'],
          },
        }),
        {replace: true}
      );
    });

    it('does not load from local storage when no query params and `skipLoadLastUsed` is true', () => {
      jest.spyOn(localStorageWrapper, 'getItem');
      initializeUrlState({
        organization,
        location: router.location,
        skipLoadLastUsed: true,
        memberProjects: projects,
        nonMemberProjects: [],
        navigate,
      });

      expect(localStorageWrapper.getItem).not.toHaveBeenCalled();
    });

    it('does not update local storage (persist) when `shouldPersist` is false', async () => {
      jest.clearAllMocks();
      jest.spyOn(localStorageWrapper, 'getItem').mockReturnValueOnce(
        JSON.stringify({
          environments: [],
          projects: [],
          pinnedFilters: ['projects'],
        })
      );

      initializeUrlState({
        organization,
        location: router.location,
        shouldPersist: false,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [],
        }),
        false
      );

      // `onInitializeUrlState` is being spied on, so PageFiltersStore wasn't actually
      // updated. We need to call `updatePersistence` manually.
      updatePersistence(false);

      await act(async () => {
        // Filters shouldn't persist even when `save` is true
        updateProjects([1], router.location, navigate, {save: true});

        // Page filter values are asynchronously persisted to local storage after a tick,
        // so we need to wait before checking for commits to local storage
        await tick();
      });

      // New value wasn't committed to local storage
      expect(localStorageWrapper.setItem).not.toHaveBeenCalled();
    });

    it('does not change dates with no query params or defaultSelection', () => {
      initializeUrlState({
        organization,
        location: {...router.location, query: {project: '1'}},
        memberProjects: projects,
        nonMemberProjects: [],
        navigate,
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
        true
      );
    });

    it('does changes to default dates with defaultSelection and no query params', () => {
      initializeUrlState({
        organization,
        location: {...router.location, query: {project: '1'}},
        memberProjects: projects,
        nonMemberProjects: [],
        defaultSelection: {
          datetime: {
            period: '3h',
            utc: null,
            start: null,
            end: null,
          },
        },
        navigate,
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
        true
      );
    });

    it('uses query params statsPeriod over defaults', () => {
      initializeUrlState({
        organization,
        location: {...router.location, query: {statsPeriod: '1h', project: '1'}},
        memberProjects: projects,
        nonMemberProjects: [],
        defaultSelection: {
          datetime: {
            period: '24h',
            utc: null,
            start: null,
            end: null,
          },
        },
        navigate,
      });
      // Navigate is not called because URL already has the correct query params
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          datetime: expect.objectContaining({period: '1h'}),
          projects: [1],
        }),
        true
      );
    });

    it('uses absolute dates over defaults', () => {
      initializeUrlState({
        organization,
        location: {
          ...router.location,
          query: {start: '2020-03-22T00:53:38', end: '2020-04-21T00:53:38', project: '1'},
        },
        memberProjects: projects,
        nonMemberProjects: [],
        defaultSelection: {
          datetime: {
            period: '24h',
            utc: null,
            start: null,
            end: null,
          },
        },
        navigate,
      });
      // Navigate is not called because URL already has the correct query params
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          datetime: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date),
          }),
          projects: [1],
        }),
        true
      );
    });

    it('does not load from local storage when there are query params', () => {
      initializeUrlState({
        organization,
        location: {...router.location, query: {project: '1'}},
        memberProjects: projects,
        nonMemberProjects: [],
        navigate,
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
        true
      );
    });

    it('does not invalidate all projects from query params', () => {
      initializeUrlState({
        organization,
        location: {...router.location, query: {project: '-1'}},
        memberProjects: projects,
        nonMemberProjects: [],
        navigate,
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
        true
      );
    });

    it('does not add non-pinned filters to query for pages with new page filters', () => {
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
        location: router.location,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
      });

      // Confirm that query params are not restored from local storage
      expect(navigate).not.toHaveBeenCalled();

      pageFilterStorageMock.mockRestore();
    });

    it('auto-selects the single non-member project when user has no member projects', () => {
      const nonMemberProject = ProjectFixture({isMember: false});
      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: [],
        nonMemberProjects: [nonMemberProject],
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: [parseInt(nonMemberProject.id, 10)],
        }),
        true
      );
    });

    it('defaults to all projects when user has no member projects but has multiple accessible projects', () => {
      const nonMemberProject1 = ProjectFixture({id: '10', isMember: false});
      const nonMemberProject2 = ProjectFixture({id: '11', isMember: false});
      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: [],
        nonMemberProjects: [nonMemberProject1, nonMemberProject2],
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: [-1],
        }),
        true
      );
    });

    it('does not set all projects when user has no member projects but is active superuser', () => {
      const superuserOrg = OrganizationFixture({access: ['org:superuser']});
      ConfigStore.set('user', UserFixture({isSuperuser: true}));
      OrganizationStore.onUpdate(superuserOrg, {replace: true});

      // When there is only one accessible project, it is auto-selected even for superusers
      const nonMemberProject = ProjectFixture({isMember: false});
      initializeUrlState({
        organization: superuserOrg,
        location: router.location,
        navigate,
        memberProjects: [],
        nonMemberProjects: [nonMemberProject],
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: [parseInt(nonMemberProject.id, 10)],
        }),
        true
      );
    });

    it('auto-selects the single project when the organization only has one', () => {
      const singleProject = ProjectFixture({id: '42', isMember: true});
      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: [singleProject],
        nonMemberProjects: [],
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: [42],
        }),
        true
      );
    });

    it('does not auto-select when there are multiple projects', () => {
      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
      });

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: [],
        }),
        true
      );
    });

    it('uses pinned filters for pages with new page filters', () => {
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
        location: router.location,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
      });

      // Confirm that only environment is restored from local storage
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: ['prod'],
            project: ['1'],
            statsPeriod: '7d',
          },
        }),
        {replace: true}
      );

      pageFilterStorageMock.mockRestore();
    });

    it('fallbacks to global state with storageNamespace empty', () => {
      const storageNamespace = 'insights:frontend';
      const insightsKey = `global-selection:${storageNamespace}:${organization.slug}`;
      const globalKey = `global-selection:${organization.slug}`;

      localStorageWrapper.setItem(
        globalKey,
        JSON.stringify({
          environments: [],
          projects: [1],
          pinnedFilters: ['datetime', 'projects', 'environments'],
          start: null,
          end: null,
          period: '30d',
          utc: null,
        })
      );

      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
        storageNamespace,
      });
      expect(localStorageWrapper.getItem).toHaveBeenCalledWith(insightsKey);
      expect(localStorageWrapper.getItem).toHaveBeenCalledWith(globalKey);

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [1],
          datetime: {
            period: '30d',
            start: null,
            end: null,
            utc: null,
          },
        }),
        true
      );
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: [],
            project: ['1'],
            statsPeriod: '30d',
          },
        }),
        {replace: true}
      );
    });

    it('uses global datetime with storageNamespace', () => {
      const storageNamespace = 'insights:frontend';
      const insightsKey = `global-selection:${storageNamespace}:${organization.slug}`;
      const globalKey = `global-selection:${organization.slug}`;
      localStorageWrapper.setItem(
        insightsKey,
        JSON.stringify({
          environments: [],
          projects: [],
          pinnedFilters: ['datetime'],
          start: null,
          end: null,
          period: '14d',
          utc: null,
        })
      );

      localStorageWrapper.setItem(
        globalKey,
        JSON.stringify({
          environments: [],
          projects: [],
          pinnedFilters: ['datetime'],
          start: null,
          end: null,
          period: '30d',
          utc: null,
        })
      );

      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
        storageNamespace,
      });
      expect(localStorageWrapper.getItem).toHaveBeenCalledWith(insightsKey);
      expect(localStorageWrapper.getItem).toHaveBeenCalledWith(globalKey);

      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [],
          datetime: {
            period: '30d',
            start: null,
            end: null,
            utc: null,
          },
        }),
        true
      );
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: [],
            project: [],
            statsPeriod: '30d',
          },
        }),
        {replace: true}
      );
    });

    it('retrieves filters from a separate key when storageNamespace is provided', () => {
      const insightsKey = `global-selection:insights:${organization.slug}`;
      localStorageWrapper.setItem(
        insightsKey,
        JSON.stringify({
          environments: [],
          projects: [1],
          pinnedFilters: ['projects', 'environments'],
        })
      );

      initializeUrlState({
        organization,
        location: router.location,
        navigate,
        memberProjects: projects,
        nonMemberProjects: [],
        storageNamespace: 'insights',
      });

      expect(localStorageWrapper.getItem).toHaveBeenCalledWith(insightsKey);
      expect(PageFiltersStore.onInitializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [1],
        }),
        true
      );
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            environment: [],
            project: ['1'],
          },
        }),
        {replace: true}
      );
    });
  });

  describe('updateProjects()', () => {
    it('updates', () => {
      updateProjects([1, 2]);
      expect(PageFiltersStore.updateProjects).toHaveBeenCalledWith([1, 2], null);
    });

    it('updates history when queries are different', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {project: '2'}},
      }).location;
      // this can be passed w/ `project` as an array (e.g. multiple projects being selected)
      // however react-router will treat it as a string if there is only one param
      updateProjects([1], location, nav);

      expect(nav).toHaveBeenCalledWith(
        {pathname: '/test/', query: {project: ['1']}},
        {replace: false}
      );
    });
    it('does not update history when queries are the same', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {project: '1'}},
      }).location;
      // this can be passed w/ `project` as an array (e.g. multiple projects
      // being selected) however react-router will treat it as a string if
      // there is only one param
      updateProjects([1], location, nav);

      expect(nav).not.toHaveBeenCalled();
    });

    it('updates history when queries are different with replace', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {project: '2'}},
      }).location;
      updateProjects([1], location, nav, {replace: true});

      expect(nav).toHaveBeenCalledWith(
        {pathname: '/test/', query: {project: ['1']}},
        {replace: true}
      );
    });

    it('does not update history when queries are the same with replace', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {project: '1'}},
      }).location;
      updateProjects([1], location, nav, {replace: true});

      expect(nav).not.toHaveBeenCalled();
    });

    it('does not override an absolute date selection', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {
          pathname: '/test/',
          query: {project: '1', start: '2020-03-22T00:53:38', end: '2020-04-21T00:53:38'},
        },
      }).location;
      updateProjects([2], location, nav, {replace: true});

      expect(nav).toHaveBeenCalledWith(
        {
          pathname: '/test/',
          query: {
            project: ['2'],
            start: '2020-03-22T00:53:38',
            end: '2020-04-21T00:53:38',
          },
        },
        {replace: true}
      );
    });
  });

  describe('updateEnvironments()', () => {
    it('updates single', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {environment: 'test'}},
      }).location;
      updateEnvironments(['new-env'], location, nav);

      expect(nav).toHaveBeenCalledWith(
        {pathname: '/test/', query: {environment: ['new-env']}},
        {replace: false}
      );
    });

    it('updates multiple', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {environment: 'test'}},
      }).location;
      updateEnvironments(['new-env', 'another-env'], location, nav);

      expect(nav).toHaveBeenCalledWith(
        {pathname: '/test/', query: {environment: ['new-env', 'another-env']}},
        {replace: false}
      );
    });

    it('removes environment', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {environment: 'test'}},
      }).location;
      updateEnvironments(null, location, nav);
      expect(nav).toHaveBeenCalledWith({pathname: '/test/', query: {}}, {replace: false});
    });

    it('does not override an absolute date selection', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {
          pathname: '/test/',
          query: {
            environment: 'test',
            start: '2020-03-22T00:53:38',
            end: '2020-04-21T00:53:38',
          },
        },
      }).location;
      updateEnvironments(['new-env'], location, nav, {replace: true});

      expect(nav).toHaveBeenCalledWith(
        {
          pathname: '/test/',
          query: {
            environment: ['new-env'],
            start: '2020-03-22T00:53:38',
            end: '2020-04-21T00:53:38',
          },
        },
        {replace: true}
      );
    });
  });

  describe('updateDateTime()', () => {
    it('updates statsPeriod when there is no existing stats period', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {}},
      }).location;
      updateDateTime({period: '24h'}, location, nav);

      expect(nav).toHaveBeenCalledWith(
        {pathname: '/test/', query: {statsPeriod: '24h'}},
        {replace: false}
      );
    });

    it('updates statsPeriod when there is an existing stats period', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {statsPeriod: '14d'}},
      }).location;
      updateDateTime({period: '24h'}, location, nav);

      expect(nav).toHaveBeenCalledWith(
        {pathname: '/test/', query: {statsPeriod: '24h'}},
        {replace: false}
      );
    });

    it('changes to absolute date', () => {
      const nav = jest.fn();
      const location = RouterFixture({
        location: {pathname: '/test/', query: {statsPeriod: '24h'}},
      }).location;
      updateDateTime(
        {start: '2020-03-22T00:53:38', end: '2020-04-21T00:53:38'},
        location,
        nav
      );

      expect(nav).toHaveBeenCalledWith(
        {
          pathname: '/test/',
          query: {start: '2020-03-22T00:53:38', end: '2020-04-21T00:53:38'},
        },
        {replace: false}
      );
    });
  });
});
