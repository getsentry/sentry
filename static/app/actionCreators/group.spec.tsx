import {bulkUpdate, mergeGroups, paramsToQueryArgs} from 'sentry/actionCreators/group';
import GroupStore from 'sentry/stores/groupStore';

describe('group', () => {
  describe('paramsToQueryArgs()', function () {
    it('should convert itemIds properties to id array', function () {
      expect(
        paramsToQueryArgs({
          itemIds: ['1', '2', '3'],
          query: 'is:unresolved', // itemIds takes precedence
        })
      ).toEqual({id: ['1', '2', '3']});
    });

    it('should extract query property if no itemIds', function () {
      const invalidArgs: any = {
        foo: 'bar',
      };

      expect(paramsToQueryArgs({query: 'is:unresolved', ...invalidArgs})).toEqual({
        query: 'is:unresolved',
      });
    });

    it('should convert params w/o itemIds or query to empty object', function () {
      const invalidArgs: any = {
        foo: 'bar',
        bar: 'baz', // paramsToQueryArgs ignores these
      };

      expect(paramsToQueryArgs(invalidArgs)).toEqual({});
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
          itemIds: ['1', '2', '3'],
          project: [1],
        })
      ).toEqual({id: ['1', '2', '3'], project: [1]});

      expect(
        paramsToQueryArgs({
          itemIds: ['1', '2', '3'],
          project: [],
        })
      ).toEqual({id: ['1', '2', '3']});

      expect(
        paramsToQueryArgs({
          itemIds: ['1', '2', '3'],
          project: null,
        })
      ).toEqual({id: ['1', '2', '3']});
    });
  });

  describe('bulkUpdate()', function () {
    beforeEach(function () {
      jest.spyOn(GroupStore, 'onUpdate'); // stub GroupStore.onUpdate call from update
    });

    it('should use itemIds as query if provided', function () {
      const request = MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      bulkUpdate(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: ['1', '2', '3'],
          data: {status: 'unresolved'},
          query: 'is:resolved',
        },
        {}
      );

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {id: ['1', '2', '3']}})
      );
    });

    it('should use query as query if itemIds are absent', function () {
      const request = MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      bulkUpdate(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: undefined,
          data: {status: 'unresolved'},
          query: 'is:resolved',
        },
        {}
      );

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {query: 'is:resolved'}})
      );
    });

    it('should apply project option', function () {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/1337/issues/',
        method: 'PUT',
      });

      bulkUpdate(
        new MockApiClient(),
        {
          orgId: '1337',
          project: [99],
          itemIds: ['1', '2', '3'],
          data: {status: 'unresolved'},
        },
        {}
      );

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        '/organizations/1337/issues/',
        expect.objectContaining({query: {id: ['1', '2', '3'], project: [99]}})
      );
    });
  });

  describe('mergeGroups()', function () {
    // TODO: this is totally copypasta from the test above. We need to refactor
    //       these API methods/tests.
    beforeEach(function () {
      jest.spyOn(GroupStore, 'onMerge'); // stub GroupStore.onMerge call from mergeGroups
    });

    it('should use itemIds as query if provided', function () {
      const request = MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      mergeGroups(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: ['1', '2', '3'],
          query: 'is:resolved',
        },
        {}
      );

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {id: ['1', '2', '3']}})
      );
    });

    it('should use query as query if itemIds are absent', function () {
      const request = MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      mergeGroups(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: undefined,
          query: 'is:resolved',
        },
        {}
      );

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({query: {query: 'is:resolved'}})
      );
    });
  });
});
