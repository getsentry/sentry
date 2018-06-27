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
});
