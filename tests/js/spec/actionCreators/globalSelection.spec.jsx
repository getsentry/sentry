import {
  updateProjects,
  updateEnvironments,
  updateDateTime,
  updateParams,
  updateParamsWithoutHistory,
} from 'app/actionCreators/globalSelection';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';

describe('GlobalSelection ActionCreators', function() {
  let updateProjectsMock;
  beforeEach(function() {
    updateProjectsMock = GlobalSelectionActions.updateProjects = jest.fn();
  });

  describe('updateProjects()', function() {
    it('updates', function() {
      updateProjects([1, 2]);
      expect(updateProjectsMock).toHaveBeenCalledWith([1, 2]);
    });

    it('does not update invalid projects', function() {
      updateProjects(['1']);
      expect(updateProjectsMock).not.toHaveBeenCalled();
    });
  });

  describe('updateEnvironments()', function() {
    it('updates single', function() {
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

    it('updates multiple', function() {
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

    it('removes environment', function() {
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

  describe('updateDateTime()', function() {
    it('updates statsPeriod when there is no existing stats period', function() {
      const router = TestStubs.router({
        location: {
          pathname: '/test/',
          query: {},
        },
      });
      updateDateTime({statsPeriod: '24h'}, router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {
          statsPeriod: '24h',
        },
      });
    });

    it('updates statsPeriod when there is an existing stats period', function() {
      const router = TestStubs.router({
        location: {
          pathname: '/test/',
          query: {statsPeriod: '14d'},
        },
      });
      updateDateTime({statsPeriod: '24h'}, router);

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {
          statsPeriod: '24h',
        },
      });
    });

    it('updates `statsPeriod` when given a new  `period`', function() {
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

    it('changes to absolute date', function() {
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

  describe('updateParams()', function() {
    it('updates history when queries are different', function() {
      const router = TestStubs.router({
        location: {
          pathname: '/test/',
          query: {project: '2'},
        },
      });
      // this can be passed w/ `project` as an array (e.g. multiple projects being selected)
      // however react-router will treat it as a string if there is only one param
      updateParams(
        {project: [1]},

        // Mock router
        router
      );

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {project: [1]},
      });
    });
    it('does not update history when queries are the same', function() {
      const router = TestStubs.router({
        location: {
          pathname: '/test/',
          query: {project: '1'},
        },
      });
      // this can be passed w/ `project` as an array (e.g. multiple projects being selected)
      // however react-router will treat it as a string if there is only one param
      updateParams(
        {project: [1]},
        // Mock router
        router
      );

      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('updateParamsWithoutHistory()', function() {
    it('updates history when queries are different', function() {
      const router = TestStubs.router({
        location: {
          pathname: '/test/',
          query: {project: '2'},
        },
      });
      // this can be passed w/ `project` as an array (e.g. multiple projects being selected)
      // however react-router will treat it as a string if there is only one param
      updateParamsWithoutHistory(
        {project: [1]},

        // Mock router
        router
      );

      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/test/',
        query: {project: [1]},
      });
    });
    it('does not update history when queries are the same', function() {
      const router = TestStubs.router({
        location: {
          pathname: '/test/',
          query: {project: '1'},
        },
      });
      // this can be passed w/ `project` as an array (e.g. multiple projects being selected)
      // however react-router will treat it as a string if there is only one param
      updateParamsWithoutHistory(
        {project: [1]},
        // Mock router
        router
      );

      expect(router.replace).not.toHaveBeenCalled();
    });
  });
});
