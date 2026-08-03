import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {decodeMetricsQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {
  buildToolLinkUrl,
  parseRunIdParam,
  useSeerExplorerDeepLink,
} from 'sentry/views/seerExplorer/utils';

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

describe('parseRunIdParam', () => {
  it('parses a legacy numeric run ID into a number', () => {
    expect(parseRunIdParam('123')).toBe(123);
  });

  it('accepts a UUID run ID as a string', () => {
    const uuid = '0fd9e7a2-1c3b-4d5e-8f90-abcdef012345';
    expect(parseRunIdParam(uuid)).toBe(uuid);
  });

  it('rejects values that are neither numeric nor a UUID', () => {
    expect(parseRunIdParam('../../foo')).toBeNull();
    expect(parseRunIdParam('not-a-uuid')).toBeNull();
    expect(parseRunIdParam('')).toBeNull();
    expect(parseRunIdParam('12.5')).toBeNull();
  });
});

describe('useSeerExplorerDeepLink', () => {
  const UUID = '0fd9e7a2-1c3b-4d5e-8f90-abcdef012345';

  function renderDeepLink(explorerRunId: string | undefined, enabled = true) {
    const callback = jest.fn();
    const {router} = renderHookWithProviders(
      () => useSeerExplorerDeepLink({callback, enabled}),
      {
        initialRouterConfig: {
          location: {
            pathname: '/issues/',
            query: explorerRunId === undefined ? {} : {explorerRunId},
          },
        },
      }
    );
    return {callback, router};
  }

  it('opens a UUID run from the deep link and strips the param', async () => {
    const {callback, router} = renderDeepLink(UUID);

    await waitFor(() => expect(callback).toHaveBeenCalledWith(UUID));
    expect(router.location.query.explorerRunId).toBeUndefined();
  });

  it('opens a legacy numeric run as a number', async () => {
    const {callback, router} = renderDeepLink('123');

    await waitFor(() => expect(callback).toHaveBeenCalledWith(123));
    expect(router.location.query.explorerRunId).toBeUndefined();
  });

  it('ignores a malformed param without navigating or invoking the callback', async () => {
    const {callback, router} = renderDeepLink('../../foo');

    // Nothing valid to do, so the param is left in place and untouched.
    await waitFor(() => expect(router.location.query.explorerRunId).toBe('../../foo'));
    expect(callback).not.toHaveBeenCalled();
  });

  it('does nothing when disabled, even with a valid param', async () => {
    const {callback, router} = renderDeepLink(UUID, false);

    await waitFor(() => expect(router.location.query.explorerRunId).toBe(UUID));
    expect(callback).not.toHaveBeenCalled();
  });
});
