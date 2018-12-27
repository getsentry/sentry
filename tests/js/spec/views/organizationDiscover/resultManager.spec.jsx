import createResultManager from 'app/views/organizationDiscover/resultManager';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('Result manager', function() {
  let resultManager, queryBuilder, discoverMock;
  beforeEach(function() {
    queryBuilder = createQueryBuilder(
      {},
      TestStubs.Organization({projects: [TestStubs.Project()]})
    );

    resultManager = createResultManager(queryBuilder);

    discoverMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/',
      method: 'POST',
      body: {
        data: [],
      },
    });
  });

  describe('getAll()', function() {
    it('returns defaults', function() {
      const data = resultManager.getAll();
      expect(data.baseQuery.query).toBeNull();
      expect(data.baseQuery.data).toBeNull();
      expect(data.byDayQuery.query).toBeNull();
      expect(data.byDayQuery.data).toBeNull();
    });
  });

  describe('fetchAll()', function() {
    it('handles raw data', async function() {
      queryBuilder.updateField('fields', ['event_id', 'project_id', 'message']);
      await resultManager.fetchAll();
      expect(discoverMock).toHaveBeenCalledTimes(1);
      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/',
        expect.objectContaining({
          data: expect.objectContaining({
            fields: ['event_id', 'project_id', 'message'],
          }),
        })
      );
    });

    it('handles aggregations', async function() {
      queryBuilder.updateField('aggregations', [['count()', null, 'count']]);
      await resultManager.fetchAll();
      expect(discoverMock).toHaveBeenCalledTimes(2);
      expect(discoverMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/query/',
        expect.objectContaining({
          data: expect.objectContaining({
            aggregations: [['count()', null, 'count']],
          }),
        })
      );
    });
  });

  describe('reset()', function() {
    it('resets', async function() {
      await resultManager.fetchAll();
      expect(resultManager.getAll().baseQuery.data).not.toBeNull();
      resultManager.reset();
      expect(resultManager.getAll().baseQuery.data).toBeNull();
    });
  });

  describe('shouldDisplayResult()', function() {
    it('is initially false', function() {
      expect(resultManager.shouldDisplayResult()).toBe(false);
    });

    it('is true after data is fetched', async function() {
      await resultManager.fetchAll();
      expect(resultManager.shouldDisplayResult()).toBe(true);
    });
  });
});
