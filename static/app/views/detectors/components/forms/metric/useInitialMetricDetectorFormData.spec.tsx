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

  it('parses dataset, aggregate, query, environment, and name from URL', () => {
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
            environment: 'prod',
            name: 'My Monitor',
          },
        },
      },
    });

    expect(result.current.dataset).toBe(DetectorDataset.SPANS);
    expect(result.current.aggregateFunction).toBe('avg(span.duration)');
    expect(result.current.query).toBe('span.op:queue.publish');
    expect(result.current.environment).toBe('prod');
    expect(result.current.name).toBe('My Monitor');
  });
});
