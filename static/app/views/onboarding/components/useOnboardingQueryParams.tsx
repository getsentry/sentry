import {useCallback} from 'react';

import {decodeBoolean, decodeList} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type QueryValues = {
  /**
   * Used to show product selection (error monitoring, tracing, profiling and session replay) for certain platforms, e.g. javascript-react
   */
  product: string[];
  /**
   * Used to show or not the integration onboarding for certain platforms, e.g. AWS (python)
   */
  showManualSetup: boolean;
};

export function useOnboardingQueryParams(): [
  params: Partial<QueryValues>,
  setParams: (newValues: Partial<QueryValues>) => void,
] {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useLocationQuery({
    fields: {
      product: decodeList,
      showManualSetup: decodeBoolean,
    },
  });

  const setParams = useCallback(
    (newValues: Partial<QueryValues>) => {
      const updatedQuery = {...location.query};

      for (const key in newValues) {
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
