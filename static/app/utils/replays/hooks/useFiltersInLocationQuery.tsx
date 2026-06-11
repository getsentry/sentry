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
type NullableReplayDetailFilterUpdate = Partial<{
  [Key in keyof ReplayDetailFilterQuery]: ReplayDetailFilterQuery[Key] | null;
}>;

type StringReplayDetailFilterKey = {
  [Key in keyof ReplayDetailFilterQuery]: ReplayDetailFilterQuery[Key] extends
    | string
    | null
    ? Key
    : never;
}[keyof ReplayDetailFilterQuery];
type ArrayReplayDetailFilterKey = {
  [Key in keyof ReplayDetailFilterQuery]: ReplayDetailFilterQuery[Key] extends
    | string[]
    | null
    ? Key
    : never;
}[keyof ReplayDetailFilterQuery];

function makeReplayDetailFilterKeys<
  StringKeys extends StringReplayDetailFilterKey,
  ArrayKeys extends ArrayReplayDetailFilterKey,
>(keys: {
  array: ArrayKeys[];
  missing: Record<Exclude<keyof ReplayDetailFilterQuery, StringKeys | ArrayKeys>, never>;
  string: StringKeys[];
}) {
  return keys;
}

const replayDetailFilterKeys = makeReplayDetailFilterKeys({
  string: [
    'f_b_search',
    'f_c_search',
    'f_e_search',
    'f_n_search',
    'f_ol_search',
    'f_t_search',
    'n_detail_row',
    'n_detail_tab',
  ],
  array: [
    'f_b_type',
    'f_c_logLevel',
    'f_e_level',
    'f_e_project',
    'f_n_method',
    'f_n_status',
    'f_n_type',
    'f_ol_severity',
  ],
  missing: {},
});

function setNullableStringValue(
  target: NullableReplayDetailFilterUpdate,
  source: ReplayDetailFilterUpdate,
  key: StringReplayDetailFilterKey
) {
  if (key in source) {
    target[key] = source[key] ?? null;
  }
}

function setNullableArrayValue(
  target: NullableReplayDetailFilterUpdate,
  source: ReplayDetailFilterUpdate,
  key: ArrayReplayDetailFilterKey
) {
  if (key in source) {
    target[key] = source[key] ?? null;
  }
}

function toNullableQuery(
  updatedQuery: ReplayDetailFilterUpdate
): NullableReplayDetailFilterUpdate {
  const nullableQuery: NullableReplayDetailFilterUpdate = {};
  for (const key of replayDetailFilterKeys.string) {
    setNullableStringValue(nullableQuery, updatedQuery, key);
  }
  for (const key of replayDetailFilterKeys.array) {
    setNullableArrayValue(nullableQuery, updatedQuery, key);
  }
  return nullableQuery;
}

export function useFiltersInLocationQuery() {
  const [query, setQuery] = useQueryStates(replayDetailFilterParsers, {
    history: 'replace',
    shallow: true,
    throttleMs: 0,
  });

  const setFilter = useCallback(
    (updatedQuery: ReplayDetailFilterUpdate) => {
      setQuery(toNullableQuery(updatedQuery));
    },
    [setQuery]
  );

  return {
    setFilter,
    query,
  };
}
