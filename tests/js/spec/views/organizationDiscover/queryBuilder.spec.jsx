import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('Query Builder', function() {
  it('generates default query with all projects', function() {
    const queryBuilder = createQueryBuilder(
      {},
      TestStubs.Organization({projects: [TestStubs.Project()]})
    );
    const external = queryBuilder.getExternal();

    expect(external.projects).toEqual([2]);
    expect(external.fields).toEqual(['event_id', 'timestamp']);
    expect(external.conditions).toHaveLength(0);
    expect(external.aggregations).toHaveLength(0);
    expect(external.orderby).toBe('-event_id');
    expect(external.limit).toBe(1000);
  });

  describe('loads()', function() {
    afterEach(function() {
      MockApiClient.clearMockResponses();
    });

    it('loads tags', async function() {
      const discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/',
        method: 'POST',
        body: {
          data: [{tags_key: ['tag1', 'tag2']}],
        },
      });
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      await queryBuilder.load();

      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/',
        expect.objectContaining({
          data: expect.objectContaining({
            aggregations: [['topK(1000)', 'tags_key', 'tags_key']],
            projects: [2],
            start: '2017-07-19T02:41:20',
            end: '2017-10-17T02:41:20',
          }),
        })
      );

      expect(queryBuilder.getColumns()).toContainEqual({name: 'tag1', type: 'string'});
      expect(queryBuilder.getColumns()).toContainEqual({name: 'tag2', type: 'string'});
      expect(queryBuilder.getColumns()).not.toContainEqual({
        name: 'environment',
        type: 'string',
      });
    });

    it('loads hardcoded tags when API request fails', async function() {
      const discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/',
        method: 'POST',
      });
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      await queryBuilder.load();

      expect(discoverMock).toHaveBeenCalled();

      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'environment',
        type: 'string',
      });
      expect(queryBuilder.getColumns()).not.toContainEqual({
        name: 'tag1',
        type: 'string',
      });
    });
  });
});
