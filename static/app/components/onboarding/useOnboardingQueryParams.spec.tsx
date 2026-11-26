import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from './gettingStartedDoc/types';
import type {DisabledProducts} from './productSelection';
import {useOnboardingQueryParams} from './useOnboardingQueryParams';

const metricsDisabled: DisabledProducts = {
  [ProductSolution.METRICS]: {reason: 'Not enabled'},
};

describe('useOnboardingQueryParams', () => {
  it('returns every product from the URL when nothing is disabled', () => {
    const query = {
      product: [ProductSolution.METRICS, ProductSolution.PERFORMANCE_MONITORING],
    };

    const {result, router} = renderHookWithProviders(() => useOnboardingQueryParams(), {
      initialRouterConfig: {location: {pathname: '/', query}},
    });

    expect(result.current[0].product).toEqual([
      ProductSolution.METRICS,
      ProductSolution.PERFORMANCE_MONITORING,
    ]);
    expect(router.location.query).toEqual(query);
  });

  it('drops disabled products from the value and the URL', async () => {
    const {result, router} = renderHookWithProviders(
      () => useOnboardingQueryParams({disabledProducts: metricsDisabled}),
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {
              product: [ProductSolution.METRICS, ProductSolution.PERFORMANCE_MONITORING],
              showManualSetup: 'true',
            },
          },
        },
      }
    );

    expect(result.current[0].product).toEqual([ProductSolution.PERFORMANCE_MONITORING]);
    expect(result.current[0].showManualSetup).toBe(true);
    await waitFor(() =>
      expect(router.location.query).toEqual({
        product: ProductSolution.PERFORMANCE_MONITORING,
        showManualSetup: 'true',
      })
    );
  });

  it('leaves the URL alone when no selected product is disabled', () => {
    const query = {product: ProductSolution.PERFORMANCE_MONITORING};

    const {result, router} = renderHookWithProviders(
      () => useOnboardingQueryParams({disabledProducts: metricsDisabled}),
      {initialRouterConfig: {location: {pathname: '/', query}}}
    );

    expect(result.current[0].product).toEqual([ProductSolution.PERFORMANCE_MONITORING]);
    expect(router.location.query).toEqual(query);
  });

  // The getsentry override can resolve the disabled list after the first render.
  it('drops a product that becomes disabled after mount', async () => {
    // The wrapper builds a new router on rerender, so the returned `router` goes
    // stale; read the URL write from nuqs instead.
    const onNuqsUrlUpdate = jest.fn();
    const {result, rerender} = renderHookWithProviders(
      (props: {disabledProducts: DisabledProducts}) => useOnboardingQueryParams(props),
      {
        onNuqsUrlUpdate,
        initialProps: {disabledProducts: {}},
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {
              product: [ProductSolution.METRICS, ProductSolution.PERFORMANCE_MONITORING],
            },
          },
        },
      }
    );

    expect(result.current[0].product).toEqual([
      ProductSolution.METRICS,
      ProductSolution.PERFORMANCE_MONITORING,
    ]);

    expect(onNuqsUrlUpdate).not.toHaveBeenCalled();

    rerender({disabledProducts: metricsDisabled});

    expect(result.current[0].product).toEqual([ProductSolution.PERFORMANCE_MONITORING]);
    await waitFor(() => expect(onNuqsUrlUpdate).toHaveBeenCalled());
    expect(onNuqsUrlUpdate.mock.lastCall[0].searchParams.getAll('product')).toEqual([
      ProductSolution.PERFORMANCE_MONITORING,
    ]);
  });
});
