import {useCallback, useMemo} from 'react';
import uniq from 'lodash/uniq';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import {filterItems} from 'sentry/views/replays/detail/utils';

export type FilterFields = {
  f_d_search: string;
  f_d_type: string[];
};

type Options = {
  traceRows: ReplayTraceRow[];
};

type Return = {
  getMutationsTypes: () => {label: string; value: string}[];
  items: ReplayTraceRow[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setType: (type: string[]) => void;
  type: string[];
};

const TYPE_TO_LABEL: Record<string, string> = {
  'ui.slowClickDetected': 'Rage & Dead Click',
  'largest-contentful-paint': 'LCP',
  'ui.click': 'User Click',
  'ui.keyDown': 'KeyDown',
  'ui.input': 'Input',
};

function typeToLabel(val: string): string {
  return TYPE_TO_LABEL[val] ?? 'Unknown';
}

const FILTERS = {
  type: (item: ReplayTraceRow, type: string[]) =>
    type.length === 0 || type.includes(getFrameOpOrCategory(item.frame)),
  searchTerm: (item: ReplayTraceRow, searchTerm: string) =>
    JSON.stringify(item.html).toLowerCase().includes(searchTerm),
};

function usePerfFilters({traceRows}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const type = useMemo(() => decodeList(query.f_d_type), [query.f_d_type]);
  const searchTerm = useMemo(
    () => decodeScalar(query.f_d_search, '').toLowerCase(),
    [query.f_d_search]
  );

  const items = useMemo(
    () =>
      filterItems({
        items: traceRows,
        filterFns: FILTERS,
        filterVals: {type, searchTerm},
      }),
    [traceRows, type, searchTerm]
  );

  const getMutationsTypes = useCallback(
    () =>
      uniq(traceRows.map(traceRow => getFrameOpOrCategory(traceRow.frame)).concat(type))
        .sort()
        .map(value => ({value, label: typeToLabel(value)})),
    [traceRows, type]
  );

  const setType = useCallback((f_d_type: string[]) => setFilter({f_d_type}), [setFilter]);

  const setSearchTerm = useCallback(
    (f_d_search: string) => setFilter({f_d_search: f_d_search || undefined}),
    [setFilter]
  );

  return {
    getMutationsTypes,
    items,
    searchTerm,
    setSearchTerm,
    setType,
    type,
  };
}

export default usePerfFilters;
