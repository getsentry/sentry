import {getBuildsExportHref} from 'sentry/views/preprod/utils/buildsExportHref';

describe('getBuildsExportHref', () => {
  it('targets the org-scoped export endpoint', () => {
    expect(getBuildsExportHref('my-org', {statsPeriod: '90d'})).toBe(
      '/api/0/organizations/my-org/builds-export/?statsPeriod=90d'
    );
  });

  it('drops pagination params', () => {
    const href = getBuildsExportHref('my-org', {
      per_page: 25,
      cursor: '0:100:0',
      query: 'foo',
    });
    expect(href).not.toContain('per_page');
    expect(href).not.toContain('cursor');
    expect(href).toContain('query=foo');
  });

  it('serializes multiple projects as repeated params', () => {
    const href = getBuildsExportHref('my-org', {
      project: ['1', '2'],
    });
    expect(href).toContain('project=1');
    expect(href).toContain('project=2');
  });

  it('includes the search query and date range', () => {
    const href = getBuildsExportHref('my-org', {
      query: 'installable:true',
      statsPeriod: '90d',
    });
    expect(decodeURIComponent(href)).toContain('query=installable:true');
    expect(href).toContain('statsPeriod=90d');
  });
});
