import {OrganizationFixture} from 'sentry-fixture/organization';

import {decodeMetricsQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {buildToolLinkUrl} from 'sentry/views/seerExplorer/utils';

describe('buildToolLinkUrl', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  it('builds metrics links with encoded metric query state from Seer metadata', () => {
    const result = buildToolLinkUrl(
      {
        kind: 'telemetry_live_search',
        params: {
          dataset: 'tracemetrics',
          query: 'metric.name:"tool.duration" metric.type:distribution',
          trace_metric: {name: 'tool.duration', type: 'distribution', unit: 'second'},
          y_axes: ['p75(value)'],
          group_by: ['environment'],
          sort: '-p75(value)',
          mode: 'aggregates',
          stats_period: '7d',
        },
      },
      organization
    );

    expect(result).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/explore/metrics/',
        query: expect.objectContaining({
          statsPeriod: '7d',
        }),
      })
    );

    const encodedMetric = (result as any)?.query?.metric?.[0];
    const decoded = decodeMetricsQueryParams(encodedMetric);

    expect(decoded?.metric).toEqual({
      name: 'tool.duration',
      type: 'distribution',
      unit: 'second',
    });
    expect(decoded?.queryParams.mode).toBe(Mode.AGGREGATE);
    expect(decoded?.queryParams.query).toBe(
      'metric.name:"tool.duration" metric.type:distribution'
    );
    expect(decoded?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p75(value,tool.duration,distribution,second)'),
      {groupBy: 'environment'},
    ]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'p75(value,tool.duration,distribution,second)', kind: 'desc'},
    ]);
  });

  it('does not build a metrics link without Seer metric metadata', () => {
    const result = buildToolLinkUrl(
      {
        kind: 'telemetry_live_search',
        params: {
          dataset: 'tracemetrics',
          query:
            'metric.name:"tool.duration" metric.type:distribution metric.unit:second',
          y_axes: ['p75(value)'],
          mode: 'aggregates',
        },
      },
      organization
    );

    expect(result).toBeNull();
  });
});
