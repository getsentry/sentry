import {useCallback} from 'react';
import type {Query} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export default function useSetQueryFieldInLocation<Q extends Query>() {
  const navigate = useNavigate();
  const {pathname, query} = useLocation<Q>();

  const setQueryParam = useCallback(
    (updatedQuery: Partial<Q>) => {
      navigate({pathname, query: {...query, ...updatedQuery}}, {replace: true});
    },
    [navigate, pathname, query]
  );

  return setQueryParam;
}
