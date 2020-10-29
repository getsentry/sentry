import createQueryBuilder from 'app/views/discover/queryBuilder';
import {openModal} from 'app/actionCreators/modal';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/actionCreators/modal');

describe('Query Builder', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
      method: 'POST',
    });
  });
  afterEach(function () {
    jest.clearAllMocks();
  });

  describe('applyDefaults()', function () {
    it('generates default query with all projects', function () {
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      const external = queryBuilder.getExternal();

      expect(external.projects).toEqual([2]);
      expect(external.fields).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(external.fields).toHaveLength(5);
      expect(external.conditions).toHaveLength(0);
      expect(external.aggregations).toHaveLength(0);
      expect(external.orderby).toBe('-timestamp');
      expect(external.limit).toBe(1000);
    });
  });

  describe('loads()', function () {
    let discoverMock;
    beforeEach(function () {
      discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {
          data: [
            {tags_key: 'tag1', count: 5},
            {tags_key: 'tag2', count: 1},
          ],
        },
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
    });

    it('loads tags for projects with membership', async function () {
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({
          projects: [
            TestStubs.Project({id: 1, isMember: false}),
            TestStubs.Project({id: 2}),
          ],
          access: ['org:read', 'org:write'],
        })
      );

      await queryBuilder.load();

      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        expect.objectContaining({
          data: expect.objectContaining({
            fields: ['tags_key'],
            aggregations: [['count()', null, 'count']],
            orderby: '-count',
            projects: [2],
            range: '90d',
            turbo: true,
          }),
        })
      );

      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'tag1',
        type: 'string',
        isTag: true,
      });
      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'tag2',
        type: 'string',
        isTag: true,
      });
      expect(queryBuilder.getColumns()).not.toContainEqual({
        name: 'environment',
        type: 'string',
        isTag: true,
      });
    });

    it("loads all project's tags for superuser", async function () {
      ConfigStore.set('user', TestStubs.User({isSuperuser: true}));
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({
          projects: [
            TestStubs.Project({id: 1, isMember: false}),
            TestStubs.Project({id: 2}),
          ],
        })
      );

      await queryBuilder.load();

      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        expect.objectContaining({
          data: expect.objectContaining({
            fields: ['tags_key'],
            aggregations: [['count()', null, 'count']],
            orderby: '-count',
            projects: [1, 2],
            range: '90d',
            turbo: true,
          }),
        })
      );

      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'tag1',
        type: 'string',
        isTag: true,
      });
      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'tag2',
        type: 'string',
        isTag: true,
      });
      expect(queryBuilder.getColumns()).not.toContainEqual({
        name: 'environment',
        type: 'string',
        isTag: true,
      });
    });

    it("loads all project's tags for org admins", async function () {
      ConfigStore.set('user', TestStubs.User());
      const queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({
          projects: [
            TestStubs.Project({id: 1, isMember: false}),
            TestStubs.Project({id: 2}),
          ],
          access: ['org:admin'],
        })
      );

      await queryBuilder.load();

      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        expect.objectContaining({
          data: expect.objectContaining({
            fields: ['tags_key'],
            aggregations: [['count()', null, 'count']],
            orderby: '-count',
            projects: [1, 2],
            range: '90d',
            turbo: true,
          }),
        })
      );
    });

    it('loads hardcoded tags when API request fails', async function () {
      discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
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
        isTag: true,
      });
      expect(queryBuilder.getColumns()).not.toContainEqual({
        name: 'tag1',
        type: 'string',
        isTag: true,
      });
    });
  });

  describe('fetch()', function () {
    let queryBuilder, discoverMock;

    beforeEach(function () {
      queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      discoverMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {
          data: [],
          timing: {},
          meta: [],
        },
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
    });

    it('makes request', async function () {
      const data = {projects: [1], fields: ['id']};
      await queryBuilder.fetch(data);
      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        expect.objectContaining({
          data,
        })
      );
    });

    it('handles no projects', async function () {
      const result = queryBuilder.fetch({projects: []});
      await expect(result).rejects.toMatchObject({
        message: 'No projects selected',
      });
      expect(discoverMock).not.toHaveBeenCalled();
    });
  });

  describe('updateField()', function () {
    let queryBuilder;
    beforeEach(function () {
      queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
    });

    it('updates field', function () {
      queryBuilder.updateField('projects', [5]);
      queryBuilder.updateField('conditions', [['id', '=', 'event1']]);

      const query = queryBuilder.getInternal();
      expect(query.conditions).toEqual([['id', '=', 'event1']]);
    });

    it('updates orderby if there is an aggregation and value is not a valid field', function () {
      queryBuilder.updateField('fields', ['id']);
      queryBuilder.updateField('aggregations', [['count()', null, 'count']]);

      const query = queryBuilder.getInternal();
      expect(query.orderby).toBe('-count');
    });

    it('updates orderby if there is no aggregation and value is not a valid field', function () {
      queryBuilder.updateField('fields', ['id']);
      queryBuilder.updateField('aggregations', [['count()', null, 'count']]);
      expect(queryBuilder.getInternal().orderby).toBe('-count');
      queryBuilder.updateField('aggregations', []);
      expect(queryBuilder.getInternal().orderby).toBe('-timestamp');
    });
  });

  describe('reset()', function () {
    let queryBuilder;
    beforeEach(function () {
      const project = TestStubs.Project({id: '1'});
      const projectWithoutMembership = TestStubs.Project({
        id: '2',
        hasAccess: false,
        isMember: false,
      });
      queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [project, projectWithoutMembership]})
      );
    });

    it('displays warning if invalid project is provided', function () {
      queryBuilder.reset({
        fields: ['id'],
        projects: [3],
      });
      expect(openModal).toHaveBeenCalled();
    });

    it('displays warning if user does not have project access', function () {
      queryBuilder.reset({
        fields: ['id'],
        projects: [2],
      });
      expect(openModal).toHaveBeenCalled();
    });

    it('does not display warning if user has access to all requested projects', function () {
      queryBuilder.reset({
        fields: ['id'],
        projects: [1],
      });
      expect(openModal).not.toHaveBeenCalled();
    });

    it('does not display warning for -1 (all projects)', function () {
      queryBuilder.reset({
        fields: ['id'],
        projects: [-1],
      });
      expect(openModal).not.toHaveBeenCalled();
    });
  });

  describe('getColumns()', function () {
    let queryBuilder;
    beforeEach(async function () {
      queryBuilder = createQueryBuilder(
        {},
        TestStubs.Organization({projects: [TestStubs.Project()]})
      );
      await queryBuilder.load();
    });

    it('returns columns and tags', function () {
      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'id',
        type: 'string',
        isTag: false,
      });

      expect(queryBuilder.getColumns()).toContainEqual({
        name: 'logger',
        type: 'string',
        isTag: true,
      });
    });
  });
});
