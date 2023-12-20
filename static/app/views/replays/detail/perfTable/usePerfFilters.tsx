import {useCallback, useMemo} from 'react';
import uniq from 'lodash/uniq';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList} from 'sentry/utils/queryString';
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
  f_p_type: string[];
};

type Options = {
  traceRows: ReplayTraceRow[];
};

type Return = {
  getCrumbTypes: () => {label: string; value: string}[];
  items: ReplayTraceRow[];
  selectValue: string[];
  setFilters: (val: PerfSelectOption[]) => void;
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
};

function usePerfFilters({traceRows}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const type = useMemo(() => decodeList(query.f_p_type), [query.f_p_type]);

  const items = useMemo(
    () =>
      filterItems({
        items: traceRows,
        filterFns: FILTERS,
        filterVals: {type},
      }),
    [traceRows, type]
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
    setFilters,
    selectValue: [...type],
  };
}

export default usePerfFilters;
