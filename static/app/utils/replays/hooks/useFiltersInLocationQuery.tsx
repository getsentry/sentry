import {useCallback} from 'react';
import type {Query} from 'history';
import {parseAsNativeArrayOf, parseAsString, useQueryStates} from 'nuqs';

const parseAsStringArray = parseAsNativeArrayOf(parseAsString);

export const replayDetailFilterParsers = {
  f_b_search: parseAsString,
  f_b_type: parseAsStringArray,
  f_c_logLevel: parseAsStringArray,
  f_c_search: parseAsString,
  f_e_level: parseAsStringArray,
  f_e_project: parseAsStringArray,
  f_e_search: parseAsString,
  f_n_method: parseAsStringArray,
  f_n_search: parseAsString,
  f_n_status: parseAsStringArray,
  f_n_type: parseAsStringArray,
  f_ol_search: parseAsString,
  f_ol_severity: parseAsStringArray,
  f_t_search: parseAsString,
  n_detail_row: parseAsString,
  n_detail_tab: parseAsString,
};

export function useFiltersInLocationQuery<Q extends Query>() {
  const [query, setQuery] = useQueryStates(replayDetailFilterParsers, {
    history: 'replace',
    shallow: true,
    throttleMs: 0,
  });

  const setFilter = useCallback(
    (updatedQuery: Partial<Q>) => {
      const nuqsQuery = Object.fromEntries(
        Object.entries(updatedQuery).map(([key, value]) => [key, value ?? null])
      );
      setQuery(nuqsQuery);
    },
    [setQuery]
  );

  return {
    setFilter,
    query: query as Q,
  };
}
