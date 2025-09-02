import replaceRouterParams from 'sentry/utils/replaceRouterParams';

const params = {
  orgId: 'org-slug',
  projectId: 'project-slug',
  project: 1234,
};

describe('replaceRouterParams', () => {
  it('replaces parameters in a path', () => {
    expect(replaceRouterParams('/path/to/:orgId/test', params)).toBe(
      '/path/to/org-slug/test'
    );
    expect(replaceRouterParams('/path/to/:orgId/test/:projectId', params)).toBe(
      '/path/to/org-slug/test/project-slug'
    );

    expect(replaceRouterParams('/path/to/:orgId/test/:project/:projectId', params)).toBe(
      '/path/to/org-slug/test/1234/project-slug'
    );
  });

  it('does not replace a path param if it doesnt exist in params object', () => {
    expect(replaceRouterParams('/path/to/:invalidId/test/', params)).toBe(
      '/path/to/:invalidId/test/'
    );
  });

  it('requires `:` prefix in route path', () => {
    expect(replaceRouterParams('/path/to/orgId/test/', params)).toBe(
      '/path/to/orgId/test/'
    );
  });
});
