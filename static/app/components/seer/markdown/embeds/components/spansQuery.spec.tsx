import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('spans query embed', () => {
  it('builds a samples-mode query', () => {
    const href = getEmbedLinkHref('spansQuery', 'Span search', {
      query: 'span.op:http.client',
      mode: 'samples',
      sort: '-span.duration',
      statsPeriod: '24h',
    });

    expect(href).toContain('/organizations/org-slug/explore/traces/');
    expect(href).toContain('mode=samples');
    expect(href).toContain('query=span.op%3Ahttp.client');
    expect(href).toContain('sort=-span.duration');
  });

  it('encodes group-bys and aggregates for aggregate mode', () => {
    const href = getEmbedLinkHref('spansQuery', 'p95 by op', {
      mode: 'aggregate',
      groupBy: ['span.op'],
      yAxes: ['p95(span.duration)'],
      title: 'p95 by op',
    });

    expect(href).toContain('mode=aggregate');

    const params = new URL(href, 'https://sentry.io').searchParams;
    expect(params.getAll('aggregateField').map(field => JSON.parse(field))).toEqual([
      {groupBy: 'span.op'},
      {yAxes: ['p95(span.duration)']},
    ]);
  });

  it('coerces numeric project IDs so agent payloads still render', () => {
    const href = getEmbedLinkHref('spansQuery', 'Issue Pageloads (Last 30 Days)', {
      mode: 'aggregate',
      query: 'span.op:pageload transaction:*issues*',
      groupBy: ['transaction'],
      yAxes: ['count()'],
      statsPeriod: '30d',
      projects: [11276],
      title: 'Issue Pageloads (Last 30 Days)',
    });

    expect(href).toContain('/organizations/org-slug/explore/traces/');
    expect(href).toContain('project=11276');
    expect(href).toContain('statsPeriod=30d');
    expect(href).toContain('mode=aggregate');
  });
});
