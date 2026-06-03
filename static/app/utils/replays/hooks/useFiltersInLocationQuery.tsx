import {useCallback} from 'react';
import {
  type inferParserType,
  parseAsNativeArrayOf,
  parseAsString,
  useQueryStates,
} from 'nuqs';

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

type ReplayDetailFilterQuery = inferParserType<typeof replayDetailFilterParsers>;
type ReplayDetailFilterUpdate = Partial<{
  [Key in keyof ReplayDetailFilterQuery]: ReplayDetailFilterQuery[Key] | undefined;
}>;

export function useFiltersInLocationQuery() {
  const [query, setQuery] = useQueryStates(replayDetailFilterParsers, {
    history: 'replace',
    shallow: true,
    throttleMs: 0,
  });

  const setFilter = useCallback(
    (updatedQuery: ReplayDetailFilterUpdate) => {
      setQuery({
        ...('f_b_search' in updatedQuery
          ? {f_b_search: updatedQuery.f_b_search ?? null}
          : {}),
        ...('f_b_type' in updatedQuery ? {f_b_type: updatedQuery.f_b_type ?? null} : {}),
        ...('f_c_logLevel' in updatedQuery
          ? {f_c_logLevel: updatedQuery.f_c_logLevel ?? null}
          : {}),
        ...('f_c_search' in updatedQuery
          ? {f_c_search: updatedQuery.f_c_search ?? null}
          : {}),
        ...('f_e_level' in updatedQuery
          ? {f_e_level: updatedQuery.f_e_level ?? null}
          : {}),
        ...('f_e_project' in updatedQuery
          ? {f_e_project: updatedQuery.f_e_project ?? null}
          : {}),
        ...('f_e_search' in updatedQuery
          ? {f_e_search: updatedQuery.f_e_search ?? null}
          : {}),
        ...('f_n_method' in updatedQuery
          ? {f_n_method: updatedQuery.f_n_method ?? null}
          : {}),
        ...('f_n_search' in updatedQuery
          ? {f_n_search: updatedQuery.f_n_search ?? null}
          : {}),
        ...('f_n_status' in updatedQuery
          ? {f_n_status: updatedQuery.f_n_status ?? null}
          : {}),
        ...('f_n_type' in updatedQuery ? {f_n_type: updatedQuery.f_n_type ?? null} : {}),
        ...('f_ol_search' in updatedQuery
          ? {f_ol_search: updatedQuery.f_ol_search ?? null}
          : {}),
        ...('f_ol_severity' in updatedQuery
          ? {f_ol_severity: updatedQuery.f_ol_severity ?? null}
          : {}),
        ...('f_t_search' in updatedQuery
          ? {f_t_search: updatedQuery.f_t_search ?? null}
          : {}),
        ...('n_detail_row' in updatedQuery
          ? {n_detail_row: updatedQuery.n_detail_row ?? null}
          : {}),
        ...('n_detail_tab' in updatedQuery
          ? {n_detail_tab: updatedQuery.n_detail_tab ?? null}
          : {}),
      });
    },
    [setQuery]
  );

  return {
    setFilter,
    query,
  };
}
