import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

import {useInitialMetricDetectorFormData} from './useInitialMetricDetectorFormData';

describe('useInitialMetricDetectorFormData', () => {
  it('returns default errors template when no query params', () => {
    const organization = OrganizationFixture();
    const {result} = renderHookWithProviders(useInitialMetricDetectorFormData, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {},
        },
      },
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        dataset: DetectorDataset.ERRORS,
        aggregateFunction: 'count()',
        query: 'is:unresolved',
      })
    );
  });

  it('respects an explicitly empty query param', () => {
    const organization = OrganizationFixture();
    const {result} = renderHookWithProviders(useInitialMetricDetectorFormData, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {
            query: '',
          },
        },
      },
    });

    expect(result.current.query).toBe('');
  });

  it('parses dataset, aggregate, and query from URL', () => {
    const organization = OrganizationFixture({features: ['performance-view']});
    const {result} = renderHookWithProviders(useInitialMetricDetectorFormData, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {
            dataset: 'spans',
            aggregate: 'avg(span.duration)',
            query: 'span.op:queue.publish',
          },
        },
      },
    });

    expect(result.current.dataset).toBe(DetectorDataset.SPANS);
    expect(result.current.aggregateFunction).toBe('avg(span.duration)');
    expect(result.current.query).toBe('span.op:queue.publish');
  });

  it('preserves an application metric aggregate from the URL', () => {
    const aggregate = 'sum(value,checkout.duration,distribution,millisecond)';
    const {result} = renderHookWithProviders(useInitialMetricDetectorFormData, {
      organization: OrganizationFixture(),
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {
            dataset: 'metrics',
            aggregate,
          },
        },
      },
    });

    expect(result.current.dataset).toBe(DetectorDataset.METRICS);
    expect(result.current.aggregateFunction).toBe(aggregate);
  });

  it('accepts a span equation from the URL with the spans-monitor-equations flag', () => {
    const aggregate = 'equation|sum(span.duration) / count(span.duration)';
    const {result} = renderHookWithProviders(useInitialMetricDetectorFormData, {
      organization: OrganizationFixture({
        features: ['performance-view', 'spans-monitor-equations'],
      }),
      initialRouterConfig: {
        location: {pathname: '/', query: {dataset: 'spans', aggregate}},
      },
    });

    expect(result.current.dataset).toBe(DetectorDataset.SPANS);
    expect(result.current.aggregateFunction).toBe(aggregate);
  });

  it('falls back to the default span aggregate for a URL equation without the flag', () => {
    const {result} = renderHookWithProviders(useInitialMetricDetectorFormData, {
      organization: OrganizationFixture({features: ['performance-view']}),
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {
            dataset: 'spans',
            aggregate: 'equation|sum(span.duration) / count(span.duration)',
          },
        },
      },
    });

    expect(result.current.dataset).toBe(DetectorDataset.SPANS);
    expect(result.current.aggregateFunction).toBe('count(span.duration)');
  });
});
