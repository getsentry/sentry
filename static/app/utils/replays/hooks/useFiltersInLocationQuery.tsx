import {useCallback} from 'react';
import type {Query} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

function useFiltersInLocationQuery<Q extends Query>() {
  const {pathname, query} = useLocation<Q>();
  const navigate = useNavigate();

  const setFilter = useCallback(
    (updatedQuery: Partial<Q>) => {
      navigate({pathname, query: {...query, ...updatedQuery}}, {replace: true});
    },
    [pathname, query, navigate]
  );

  return {
    setFilter,
    query,
  };
}

export default useFiltersInLocationQuery;
