import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('Query Builder', function() {
  describe('applyDefaults()', function() {
    it('generates default query with all projects', function() {
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      const external = queryBuilder.getExternal();

      expect(external.projects).toEqual([2]);
      expect(external.fields).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(external.fields).toHaveLength(46);
      expect(external.conditions).toHaveLength(0);
      expect(external.aggregations).toHaveLength(0);
      expect(external.orderby).toBe('-timestamp');
      expect(external.limit).toBe(1000);
    });
  });

  describe('loads()', function() {
    afterEach(function() {
      MockApiClient.clearMockResponses();
    });

    it('loads tags', async function() {
      const discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/',
        method: 'POST',
        body: {
          data: [{tags_key: 'tag1', count: 5}, {tags_key: 'tag2', count: 1}],
        },
      });
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      await queryBuilder.load();

      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/',
        expect.objectContaining({
          data: expect.objectContaining({
            fields: ['tags_key'],
            aggregations: [['count()', null, 'count']],
            orderby: '-count',
            projects: [2],
            range: '90d',
          }),
        })
      );

      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'tags[tag1]',
        type: 'string',
      });
      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'tags[tag2]',
        type: 'string',
      });
      expect(queryBuilder.getColumns()).not.toContainEqual({
        name: 'tags[environment]',
        type: 'string',
      });
    });

    it('loads hardcoded tags when API request fails', async function() {
      const discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/',
        method: 'POST',
      });
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      await queryBuilder.load();

      expect(discoverMock).toHaveBeenCalled();

      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'tags[environment]',
        type: 'string',
      });
      expect(queryBuilder.getColumns()).not.toContainEqual({
        name: 'tags[tag1]',
        type: 'string',
      });
    });
  });

  describe('fetch()', function() {
    let queryBuilder, discoverMock;

    beforeEach(function() {
      queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/',
        method: 'POST',
      });
    });

    afterEach(function() {
      MockApiClient.clearMockResponses();
    });

    it('makes request', async function() {
      const data = {projects: [1], fields: ['event_id']};
      await queryBuilder.fetch(data);
      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/',
        expect.objectContaining({
          data,
        })
      );
    });

    it('handles no projects', async function() {
      const result = queryBuilder.fetch({projects: []});
      await expect(result).rejects.toMatchObject({
        message: 'No projects selected',
      });
      expect(discoverMock).not.toHaveBeenCalled();
    });
  });

  describe('updateField()', function() {
    let queryBuilder;
    beforeEach(function() {
      queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
    });

    it('updates field', function() {
      queryBuilder.updateField('projects', [5]);
      queryBuilder.updateField('conditions', [['event_id', '=', 'event1']]);

      const query = queryBuilder.getInternal();
      expect(query.conditions).toEqual([['event_id', '=', 'event1']]);
    });

    it('updates orderby if there is an aggregation and value is not a valid field', function() {
      queryBuilder.updateField('aggregations', [['count()', null, 'count']]);

      const query = queryBuilder.getInternal();
      expect(query.orderby).toBe('-count');
    });

    it('updates orderby if there is no aggregation and value is not a valid field', function() {
      queryBuilder.updateField('aggregations', [['count()', null, 'count']]);
      expect(queryBuilder.getInternal().orderby).toBe('-count');
      queryBuilder.updateField('aggregations', []);
      expect(queryBuilder.getInternal().orderby).toBe('-timestamp');
    });
  });
});
