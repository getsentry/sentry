import replaceRouterParams from 'app/utils/replaceRouterParams';

const params = {
  orgId: 'org-slug',
  projectId: 'project-slug',
};

describe('replaceRouterParams', function () {
  it('replaces `:orgId` in a path', function () {
    expect(replaceRouterParams('/path/to/:orgId/test', params)).toBe(
      '/path/to/org-slug/test'
    );
    expect(replaceRouterParams('/path/to/:orgId/test/:projectId', params)).toBe(
      '/path/to/org-slug/test/project-slug'
    );
  });

  it('does not replace a path param if it doesnt exist in params object', function () {
    expect(replaceRouterParams('/path/to/:invalidId/test/', params)).toBe(
      '/path/to/:invalidId/test/'
    );
  });

  it('requires `:` prefix in route path', function () {
    expect(replaceRouterParams('/path/to/orgId/test/', params)).toBe(
      '/path/to/orgId/test/'
    );
  });
});
