import {
  initializeUrlState,
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'sentry/actionCreators/pageFilters';
import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import localStorage from 'sentry/utils/localStorage';

jest.mock('sentry/utils/localStorage');

describe('PageFilters ActionCreators', function () {
  const organization = TestStubs.Organization();
  beforeEach(function () {
    localStorage.getItem.mockClear();
    jest.spyOn(PageFiltersActions, 'updateProjects');
    jest.spyOn(PageFiltersActions, 'initializeUrlState').mockImplementation();
    PageFiltersActions.updateProjects.mockClear();
  });

  describe('initializeUrlState', function () {
    let router;
    beforeEach(() => {
      router = TestStubs.router();
    });
    it('loads from local storage when no query params', function () {
      const key = `global-selection:${organization.slug}`;
      localStorage.setItem(key, JSON.stringify({environments: [], projects: [1]}));
      initializeUrlState({
        organization,
        queryParams: {},
        router,
      });

      expect(localStorage.getItem).toHaveBeenCalledWith(
        `global-selection:${organization.slug}`
      );
      expect(PageFiltersActions.initializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [],
          projects: [1],
        }),
        new Set()
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
        router,
      });

      expect(localStorage.getItem).not.toHaveBeenCalled();
    });

    it('does not change dates with no query params or defaultSelection', function () {
      initializeUrlState({
        organization,
        queryParams: {
          project: '1',
        },
        router,
      });
      expect(PageFiltersActions.initializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          datetime: {
            start: null,
            end: null,
            period: '14d',
            utc: null,
          },
        }),
        new Set()
      );
    });

    it('does changes to default dates with defaultSelection and no query params', function () {
      initializeUrlState({
        organization,
        queryParams: {
          project: '1',
        },
        defaultSelection: {
          datetime: {
            period: '3h',
          },
        },
        router,
      });
      expect(PageFiltersActions.initializeUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          datetime: {
            start: null,
            end: null,
            period: '3h',
            utc: null,
          },
        }),
        new Set()
      );
    });

    it('uses query params statsPeriod over defaults', function () {
      initializeUrlState({
        organization,
        queryParams: {
          statsPeriod: '1h',
          project: '1',
        },
        defaultSelection: {
          datetime: {
            period: '24h',
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
        defaultSelection: {
          datetime: {
            period: '24h',
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
        router,
      });

      expect(PageFiltersActions.initializeUrlState).toHaveBeenCalledWith(
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
        new Set()
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
      expect(PageFiltersActions.updateProjects).toHaveBeenCalledWith([1, 2], undefined);
    });

    it('does not update invalid projects', function () {
      updateProjects(['1']);
      expect(PageFiltersActions.updateProjects).not.toHaveBeenCalled();
    });

    it('updates history when queries are different', function () {
      const router = TestStubs.router({
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
      const router = TestStubs.router({
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
      const router = TestStubs.router({
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
      const router = TestStubs.router({
        location: {
          pathname: '/test/',
          query: {project: '1'},
        },
      });
      updateProjects([1], router, {replace: true});

      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe('updateEnvironments()', function () {
    it('updates single', function () {
      const router = TestStubs.router({
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
      const router = TestStubs.router({
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
      const router = TestStubs.router({
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
  });

  describe('updateDateTime()', function () {
    it('updates statsPeriod when there is no existing stats period', function () {
      const router = TestStubs.router({
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
      const router = TestStubs.router({
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
      const router = TestStubs.router({
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
});
