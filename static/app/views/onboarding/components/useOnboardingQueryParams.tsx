import {useCallback, useMemo} from 'react';

import type {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type QueryValues = {
  /**
   * Used to show product selection for certain platforms, e.g. javascript
   */
  product?: ProductSolution[];
  /**
   * Used to show the loader script for when the platform is javascript
   */
  showLoader?: boolean;
  /**
   * Used to show or not the integration onboarding for certain platforms, e.g. AWS (python)
   */
  showManualSetup?: boolean;
};

const ONBOARDING_QUERY_PARAMS: (keyof QueryValues)[] = [
  'showManualSetup',
  'showLoader',
  'product',
];

export function useOnboardingQueryParams(): [
  params: Partial<QueryValues>,
  setParams: (newValues: Partial<QueryValues>) => void,
] {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => {
    const values = ONBOARDING_QUERY_PARAMS.reduce((acc, key) => {
      const value = location.query[key];
      acc[key] =
        value === 'true'
          ? true
          : value === 'false'
            ? false
            : Array.isArray(value)
              ? decodeList(value)
              : value;
      return acc;
    }, {}) as Partial<QueryValues>;

    return values;
  }, [location.query]);

  const setParams = useCallback(
    (newValues: Partial<QueryValues>) => {
      const updatedQuery = {...location.query};

      for (const key in newValues) {
        updatedQuery[key] = newValues[key];
      }

      navigate(
        {
          ...location,
          query: updatedQuery,
        },
        {replace: true}
      );
    },
    [location, navigate]
  );

  return [params, setParams];
}
