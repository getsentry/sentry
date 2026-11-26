import {useEffect, useMemo} from 'react';
import {parseAsBoolean, useQueryStates} from 'nuqs';

import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

import type {ProductSolution} from './gettingStartedDoc/types';

type QueryValues = {
  /**
   * Used to show product selection (error monitoring, tracing, profiling and session replay) for certain platforms, e.g. javascript-react
   */
  product: ProductSolution[];
  /**
   * Used to show or not the integration onboarding for certain platforms, e.g. AWS (python)
   */
  showManualSetup: boolean;
};

const onboardingParsers = {
  product: parseAsStringArray,
  showManualSetup: parseAsBoolean.withDefault(false),
};

type Options = {
  /**
   * Products the organization does not have. They are dropped from `product`
   * and removed from the URL, so they can't be selected or reach the setup snippet.
   */
  disabledProducts?: Partial<Record<ProductSolution, unknown>>;
};

export function useOnboardingQueryParams({disabledProducts}: Options = {}): [
  params: QueryValues,
  setParams: (newValues: Partial<QueryValues>) => void,
] {
  const [params, setParams] = useQueryStates(onboardingParsers, {history: 'replace'});
  const urlProducts = params.product as ProductSolution[];

  const product = useMemo(
    () => urlProducts.filter(p => !disabledProducts?.[p]),
    [urlProducts, disabledProducts]
  );

  useEffect(() => {
    if (product.length !== urlProducts.length) {
      setParams({product});
    }
  }, [product, urlProducts, setParams]);

  const filteredParams = useMemo(() => ({...params, product}), [params, product]);

  return [filteredParams, setParams];
}
