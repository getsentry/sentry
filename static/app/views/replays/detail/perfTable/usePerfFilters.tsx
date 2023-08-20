import {useCallback, useMemo} from 'react';
import uniq from 'lodash/uniq';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import {filterItems} from 'sentry/views/replays/detail/utils';

export interface PerfSelectOption extends SelectOption<string> {
  qs: 'f_p_type';
}

const DEFAULT_FILTERS = {
  f_p_type: [],
} as Record<PerfSelectOption['qs'], string[]>;

export type FilterFields = {
  f_p_search: string;
  f_p_type: string[];
};

type Options = {
  traceRows: ReplayTraceRow[];
};

type Return = {
  getCrumbTypes: () => {label: string; value: string}[];
  items: ReplayTraceRow[];
  searchTerm: string;
  selectValue: string[];
  setFilters: (val: PerfSelectOption[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const TYPE_TO_LABEL: Record<string, string> = {
  'ui.click': 'User Click',
  'ui.slowClickDetected': 'Rage & Dead Click',
  'navigation.back_forward': 'Navigate Back/Forward',
  'navigation.navigate': 'Page Load',
  'navigation.push': 'Navigation',
  'navigation.reload': 'Reload',
};

function typeToLabel(val: string): string {
  return TYPE_TO_LABEL[val] ?? 'Unknown';
}

const FILTERS = {
  type: (item: ReplayTraceRow, type: string[]) =>
    type.length === 0 || type.includes(getFrameOpOrCategory(item.replayFrame)),
  searchTerm: (item: ReplayTraceRow, searchTerm: string) =>
    // TOOD: this should not only look at replayFrame, there's lots of stuff to see
    JSON.stringify(item.replayFrame).toLowerCase().includes(searchTerm),
};

function usePerfFilters({traceRows}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const type = useMemo(() => decodeList(query.f_p_type), [query.f_p_type]);
  const searchTerm = decodeScalar(query.f_p_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: traceRows,
        filterFns: FILTERS,
        filterVals: {type, searchTerm},
      }),
    [traceRows, type, searchTerm]
  );

  const getCrumbTypes = useCallback(
    () =>
      uniq(
        traceRows.map(traceRow => getFrameOpOrCategory(traceRow.replayFrame)).concat(type)
      )
        .sort()
        .map(value => ({
          value,
          label: typeToLabel(value),
          qs: 'f_p_type',
        })),
    [traceRows, type]
  );

  const setSearchTerm = useCallback(
    (f_p_search: string) => setFilter({f_p_search: f_p_search || undefined}),
    [setFilter]
  );

  const setFilters = useCallback(
    (value: PerfSelectOption[]) => {
      const groupedValues = value.reduce((state, selection) => {
        return {
          ...state,
          [selection.qs]: [...state[selection.qs], selection.value],
        };
      }, DEFAULT_FILTERS);
      setFilter(groupedValues);
    },
    [setFilter]
  );

  return {
    getCrumbTypes,
    items,
    searchTerm,
    setSearchTerm,
    setFilters,
    selectValue: [...type],
  };
}

export default usePerfFilters;
