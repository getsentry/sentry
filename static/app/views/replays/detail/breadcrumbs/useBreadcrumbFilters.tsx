import {useCallback, useMemo} from 'react';
import uniq from 'lodash/uniq';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {getFrameOpOrCategory, ReplayFrame} from 'sentry/utils/replays/types';
import {filterItems} from 'sentry/views/replays/detail/utils';

export type FilterFields = {
  f_b_search: string;
  f_b_type: string[];
};

type Options = {
  frames: ReplayFrame[];
};

type Return = {
  getBreadcrumbTypes: () => {label: string; value: string}[];
  items: ReplayFrame[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setType: (type: string[]) => void;
  type: string[];
};

const FILTERS = {
  type: (item: ReplayFrame, type: string[]) =>
    type.length === 0 || type.includes(getFrameOpOrCategory(item)),
  searchTerm: (item: ReplayFrame, searchTerm: string) =>
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

  const TYPE_TO_LABEL: Record<string, string> = useMemo(() => ({}), []);
  frames.forEach(frame => {
    const frameType = getFrameOpOrCategory(frame);
    const label = getFrameDetails(frame).title?.toString();
    if (frameType && label) {
      TYPE_TO_LABEL[frameType] = label;
    }
  });

  const getBreadcrumbTypes = useCallback(
    () =>
      uniq(frames.map(frame => getFrameOpOrCategory(frame)).concat(type))
        .sort()
        .map(value => ({
          value,
          label: TYPE_TO_LABEL[value],
        })),
    [frames, type, TYPE_TO_LABEL]
  );

  const setType = useCallback((f_b_type: string[]) => setFilter({f_b_type}), [setFilter]);

  const setSearchTerm = useCallback(
    (f_b_search: string) => setFilter({f_b_search: f_b_search || undefined}),
    [setFilter]
  );

  return {
    getBreadcrumbTypes,
    items,
    searchTerm,
    setSearchTerm,
    setType,
    type,
  };
}

export default useBreadcrumbFilters;
