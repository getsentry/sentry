import {useCallback} from 'react';
import type {Query} from 'history';

import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';

function useFiltersInLocationQuery<Q extends Query>() {
  const {pathname, query} = useLocation<Q>();

  const setFilter = useCallback(
    (updatedQuery: Partial<Q>) => {
      browserHistory.replace({pathname, query: {...query, ...updatedQuery}});
    },
    [pathname, query]
  );

  return {
    setFilter,
    query,
  };
}

export default useFiltersInLocationQuery;
