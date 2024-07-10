import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useSetQueryFieldInLocation from 'sentry/utils/url/useSetQueryFieldInLocation';
import {filterItems} from 'sentry/views/replays/detail/utils';

export interface AccessibilitySelectOption extends SelectOption<string> {
  qs: 'f_a_impact' | 'f_a_type';
}

const DEFAULT_FILTERS = {
  f_a_impact: [],
  f_a_type: [],
} as Record<AccessibilitySelectOption['qs'], string[]>;

export type FilterFields = {
  f_a_impact: string[];
  f_a_search: string;
  f_a_type: string[];
  a_detail_row?: string;
};

type Options = {
  accessibilityData: HydratedA11yFrame[];
};

type Return = {
  getImpactLevels: () => AccessibilitySelectOption[];
  getIssueTypes: () => AccessibilitySelectOption[];
  items: HydratedA11yFrame[];
  searchTerm: string;
  selectValue: string[];
  setFilters: (val: AccessibilitySelectOption[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  impact: (item: HydratedA11yFrame, impacts: string[]) =>
    impacts.length === 0 || impacts.includes(item.impact ?? ''),
  type: (item: HydratedA11yFrame, types: string[]) =>
    types.length === 0 || types.includes(item.id),
  searchTerm: (item: HydratedA11yFrame, searchTerm: string) => {
    return JSON.stringify(item).toLowerCase().includes(searchTerm);
  },
};

const IMPACT_SORT_ORDER = {
  minor: 3,
  moderate: 3,
  serious: 2,
  critical: 1,
};

function useAccessibilityFilters({accessibilityData}: Options): Return {
  const setQueryParam = useSetQueryFieldInLocation<FilterFields>();

  const {
    f_a_impact: impact,
    f_a_type: type,
    f_a_search: searchTerm,
  } = useLocationQuery({
    fields: {
      f_a_impact: decodeList,
      f_a_type: decodeList,
      f_a_search: decodeScalar,
    },
  });

  const setFilterAndClearDetails = useCallback(
    arg => {
      setQueryParam({
        ...arg,
        a_detail_row: undefined,
      });
    },
    [setQueryParam]
  );

  const items = useMemo(
    () =>
      filterItems({
        items: accessibilityData,
        filterFns: FILTERS,
        filterVals: {impact, type, searchTerm: searchTerm.toLowerCase()},
      }),
    [accessibilityData, impact, type, searchTerm]
  );

  const getImpactLevels = useCallback(
    () =>
      Array.from(
        new Set(accessibilityData.map(data => String(data.impact)).concat(impact))
      )
        .filter(Boolean)
        .sort((a, b) => (IMPACT_SORT_ORDER[a] < IMPACT_SORT_ORDER[b] ? -1 : 1))
        .map(
          (value): AccessibilitySelectOption => ({
            value,
            label: value,
            qs: 'f_a_impact',
          })
        ),
    [accessibilityData, impact]
  );

  const getIssueTypes = useCallback(
    () =>
      Array.from(new Set(accessibilityData.map(data => data.id).concat(type)))
        .sort()
        .map(
          (value): AccessibilitySelectOption => ({
            value,
            label: value,
            qs: 'f_a_type',
          })
        ),
    [accessibilityData, type]
  );

  const setSearchTerm = useCallback(
    (f_a_search: string) =>
      setFilterAndClearDetails({f_a_search: f_a_search || undefined}),
    [setFilterAndClearDetails]
  );

  const setFilters = useCallback(
    (value: AccessibilitySelectOption[]) => {
      const groupedValues = value.reduce((state, selection) => {
        return {
          ...state,
          [selection.qs]: [...state[selection.qs], selection.value],
        };
      }, DEFAULT_FILTERS);
      setFilterAndClearDetails(groupedValues);
    },
    [setFilterAndClearDetails]
  );

  return {
    getImpactLevels,
    getIssueTypes,
    items,
    searchTerm,
    selectValue: [...impact, ...type],
    setFilters,
    setSearchTerm,
  };
}

export default useAccessibilityFilters;
