import {bulkUpdate, mergeGroups, paramsToQueryArgs} from 'sentry/actionCreators/group';
import GroupStore from 'sentry/stores/groupStore';

describe('group', () => {
  describe('paramsToQueryArgs()', () => {
    it('should convert itemIds properties to id array', () => {
      expect(
        paramsToQueryArgs({
          itemIds: ['1', '2', '3'],
          query: 'is:unresolved', // itemIds takes precedence
        })
      ).toEqual({id: ['1', '2', '3']});
    });

    it('should extract query property if no itemIds', () => {
      const invalidArgs: any = {
        foo: 'bar',
      };

      expect(paramsToQueryArgs({query: 'is:unresolved', ...invalidArgs})).toEqual({
        query: 'is:unresolved',
      });
    });

    it('should convert params w/o itemIds or query to empty object', () => {
      const invalidArgs: any = {
        foo: 'bar',
        bar: 'baz', // paramsToQueryArgs ignores these
      };

      expect(paramsToQueryArgs(invalidArgs)).toEqual({});
    });

    it('should keep environment when query is provided', () => {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          environment: 'production',
        })
      ).toEqual({query: 'is:unresolved', environment: 'production'});
    });

    it('should exclude environment when it is null/undefined', () => {
      expect(
        paramsToQueryArgs({
          query: 'is:unresolved',
          environment: null,
        })
      ).toEqual({query: 'is:unresolved'});
    });

    it('should handle non-empty projects', () => {
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

  describe('bulkUpdate()', () => {
    beforeEach(() => {
      jest.spyOn(GroupStore, 'onUpdate'); // stub GroupStore.onUpdate call from update
    });

    it('should use itemIds as query if provided', () => {
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

    it('should use query as query if itemIds are absent', () => {
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

    it('should apply project option', () => {
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

  describe('mergeGroups()', () => {
    // TODO: this is totally copypasta from the test above. We need to refactor
    //       these API methods/tests.
    beforeEach(() => {
      jest.spyOn(GroupStore, 'onMerge'); // stub GroupStore.onMerge call from mergeGroups
    });

    it('should use itemIds as query if provided', () => {
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

    it('should use query as query if itemIds are absent', () => {
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
