import {bulkUpdate, mergeGroups, paramsToQueryArgs} from 'app/actionCreators/group';
import GroupActions from 'app/actions/groupActions';
import {Client} from 'app/api';

describe('group', () => {
  let api;

  beforeEach(function () {
    api = new Client();
  });

  describe('paramsToQueryArgs()', function () {
    it('should convert itemIds properties to id array', function () {
      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          query: 'is:unresolved', // itemIds takes precedence
        })
      ).toEqual({id: [1, 2, 3]});
    });

    it('should extract query property if no itemIds', function () {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          foo: 'bar',
        })
      ).toEqual({query: 'is:unresolved'});
    });

    it('should convert params w/o itemIds or query to empty object', function () {
      expect(
        paramsToQueryArgs({
          foo: 'bar',
          bar: 'baz', // paramsToQueryArgs ignores these
        })
      ).toEqual({});
    });

    it('should keep environment when query is provided', function () {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          environment: 'production',
        })
      ).toEqual({query: 'is:unresolved', environment: 'production'});
    });

    it('should exclude environment when it is null/undefined', function () {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          environment: null,
        })
      ).toEqual({query: 'is:unresolved'});
    });

    it('should handle non-empty projects', function () {
      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          project: [1],
        })
      ).toEqual({id: [1, 2, 3], project: [1]});

      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          project: [],
        })
      ).toEqual({id: [1, 2, 3]});

      expect(
        paramsToQueryArgs({
          itemIds: [1, 2, 3],
          project: null,
        })
      ).toEqual({id: [1, 2, 3]});
    });
  });

  describe('bulkUpdate()', function () {
    beforeEach(function () {
      jest.spyOn(api, 'request');
      jest.spyOn(GroupActions, 'update'); // stub GroupActions.update call from update
    });

    it('should use itemIds as query if provided', function () {
      bulkUpdate(api, {
        orgId: '1337',
        projectId: '1337',
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {id: [1, 2, 3]}})
      );
    });

    it('should use query as query if itemIds are absent', function () {
      bulkUpdate(api, {
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {query: 'is:resolved'}})
      );
    });

    it('should apply project option', function () {
      bulkUpdate(api, {
        orgId: '1337',
        project: [99],
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
      });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith(
        '/organizations/1337/issues/',
        expect.objectContaining({query: {id: [1, 2, 3], project: [99]}})
      );
    });
  });

  describe('mergeGroups()', function () {
    // TODO: this is totally copypasta from the test above. We need to refactor
    //       these API methods/tests.
    beforeEach(function () {
      jest.spyOn(api, 'request');
      jest.spyOn(GroupActions, 'merge'); // stub GroupActions.merge call from mergeGroups
    });

    it('should use itemIds as query if provided', function () {
      mergeGroups(api, {
        orgId: '1337',
        projectId: '1337',
        itemIds: [1, 2, 3],
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {id: [1, 2, 3]}})
      );
    });

    it('should use query as query if itemIds are absent', function () {
      mergeGroups(api, {
        orgId: '1337',
        projectId: '1337',
        itemIds: null,
        data: {status: 'unresolved'},
        query: 'is:resolved',
      });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {query: 'is:resolved'}})
      );
    });
  });
});
