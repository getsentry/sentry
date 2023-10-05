import {useCallback, useMemo} from 'react';
import uniq from 'lodash/uniq';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {BreadcrumbFrame, getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {filterItems} from 'sentry/views/replays/detail/utils';

export type FilterFields = {
  f_b_search: string;
  f_b_type: string[];
};

type Options = {
  frames: BreadcrumbFrame[];
};

type Return = {
  getMutationsTypes: () => {label: string; value: string}[];
  items: BreadcrumbFrame[];
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
  type: (item: BreadcrumbFrame, type: string[]) =>
    type.length === 0 || type.includes(item.type),
  searchTerm: (item: BreadcrumbFrame, searchTerm: string) =>
    JSON.stringify(item).toLowerCase().includes(searchTerm),
};

function useBreadcrumbFilters({frames}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const type = useMemo(() => decodeList(query.f_b_type), [query.f_b_type]);
  const searchTerm = decodeScalar(query.f_b_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: frames,
        filterFns: FILTERS,
        filterVals: {type, searchTerm},
      }),
    [frames, type, searchTerm]
  );

  const getMutationsTypes = useCallback(
    () =>
      uniq(frames.map(mutation => getFrameOpOrCategory(mutation)).concat(type))
        .sort()
        .map(value => ({value, label: typeToLabel(value)})),
    [frames, type]
  );

  const setType = useCallback((f_b_type: string[]) => setFilter({f_b_type}), [setFilter]);

  const setSearchTerm = useCallback(
    (f_b_search: string) => setFilter({f_b_search: f_b_search || undefined}),
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

export default useBreadcrumbFilters;
