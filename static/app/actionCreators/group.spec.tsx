import {
  bulkDelete,
  bulkUpdate,
  mergeGroups,
  paramsToQueryArgs,
} from 'sentry/actionCreators/group';
import {GroupStore} from 'sentry/stores/groupStore';

describe('group', () => {
  it('completes bulk actions without a request when itemIds is empty', async () => {
    const api = new MockApiClient();
    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'PUT',
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'DELETE',
    });
    const params = {orgId: 'org-slug', itemIds: [], query: 'is:unresolved'};
    const callbacks = {success: jest.fn(), complete: jest.fn()};

    await bulkUpdate(api, {...params, data: {status: 'resolved'}}, callbacks);
    await bulkDelete(api, params, callbacks);
    await mergeGroups(api, params, callbacks);

    expect(updateRequest).not.toHaveBeenCalled();
    expect(deleteRequest).not.toHaveBeenCalled();
    expect(callbacks.success).toHaveBeenCalledTimes(3);
    expect(callbacks.complete).toHaveBeenCalledTimes(3);
  });

  describe('paramsToQueryArgs()', () => {
    it('should convert itemIds properties to id array', () => {
      expect(
        paramsToQueryArgs({
          itemIds: ['1', '2', '3'],
          query: 'is:unresolved', // itemIds takes precedence
          environment: ['production'],
          period: '24h',
          sort: 'freq',
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

    it('preserves an empty search with environment, relative dates, and sort', () => {
      expect(
        paramsToQueryArgs({
          query: '',
          project: [1, 2],
          environment: ['production'],
          period: '24h',
          utc: false,
          sort: 'freq',
        })
      ).toEqual({
        query: '',
        project: [1, 2],
        environment: ['production'],
        statsPeriod: '24h',
        utc: false,
        sort: 'freq',
      });
    });

    it('preserves absolute dates for an empty search in the issue list format', () => {
      expect(
        paramsToQueryArgs({
          query: '',
          start: new Date('2026-09-01T10:00:00-07:00'),
          end: '2026-09-02T10:00:00-07:00',
          period: null,
          utc: true,
        })
      ).toEqual({
        query: '',
        start: '2026-09-01T17:00:00',
        end: '2026-09-02T17:00:00',
        utc: true,
      });
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

    it('should normalize string assignedTo to Actor object for optimistic update', () => {
      MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      bulkUpdate(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: ['1'],
          data: {assignedTo: 'user:123'},
        },
        {}
      );

      expect(GroupStore.onUpdate).toHaveBeenCalledWith(expect.any(String), ['1'], {
        assignedTo: {type: 'user', id: '123', name: ''},
      });
    });

    it('should normalize empty assignedTo string to null for optimistic update', () => {
      MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      bulkUpdate(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: ['1'],
          data: {assignedTo: ''},
        },
        {}
      );

      expect(GroupStore.onUpdate).toHaveBeenCalledWith(expect.any(String), ['1'], {
        assignedTo: null,
      });
    });

    it('should normalize team assignedTo string for optimistic update', () => {
      MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      bulkUpdate(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: ['1'],
          data: {assignedTo: 'team:456'},
        },
        {}
      );

      expect(GroupStore.onUpdate).toHaveBeenCalledWith(expect.any(String), ['1'], {
        assignedTo: {type: 'team', id: '456', name: ''},
      });
    });

    it('should send raw string assignedTo to the API', () => {
      const request = MockApiClient.addMockResponse({
        url: '/projects/1337/1337/issues/',
        method: 'PUT',
      });

      bulkUpdate(
        new MockApiClient(),
        {
          orgId: '1337',
          projectId: '1337',
          itemIds: ['1'],
          data: {assignedTo: 'user:123'},
        },
        {}
      );

      expect(request).toHaveBeenCalledWith(
        '/projects/1337/1337/issues/',
        expect.objectContaining({data: {assignedTo: 'user:123'}})
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
