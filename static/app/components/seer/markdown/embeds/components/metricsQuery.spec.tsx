import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('metrics query embed', () => {
  it('encodes the metric as a single JSON param', () => {
    const href = getEmbedLinkHref('metricsQuery', 'checkout.latency', {
      name: 'checkout.latency',
      type: 'distribution',
      unit: 'millisecond',
      mode: 'aggregate',
      yAxes: ['p95(value)'],
    });

    expect(href).toContain('/organizations/org-slug/explore/metrics/');

    const metric = new URL(href, 'https://sentry.io').searchParams.get('metric');
    expect(JSON.parse(metric ?? '{}')).toEqual({
      metric: {name: 'checkout.latency', type: 'distribution', unit: 'millisecond'},
      query: '',
      aggregateFields: [{yAxes: ['p95(value)']}],
      mode: 'aggregate',
    });
  });

  it('charts a default aggregate so the query stays decodable', () => {
    const href = getEmbedLinkHref('metricsQuery', 'checkout.latency', {
      name: 'checkout.latency',
      type: 'distribution',
    });

    const metric = new URL(href, 'https://sentry.io').searchParams.get('metric');
    expect(JSON.parse(metric ?? '{}').aggregateFields).toEqual([{yAxes: ['sum(value)']}]);
  });
});
