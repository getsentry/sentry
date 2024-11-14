import type {RefObject} from 'react';
import {useCallback, useMemo, useRef} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {defined} from 'sentry/utils';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {
  type BreadcrumbFrame,
  type ConsoleFrame,
  isConsoleFrame,
} from 'sentry/utils/replays/types';
import {filterItems} from 'sentry/views/replays/detail/utils';

export interface ConsoleSelectOption extends SelectOption<string> {
  qs: 'f_c_logLevel' | 'f_c_search';
}

export type FilterFields = {
  f_c_logLevel: string[];
  f_c_search: string;
};

type Options = {
  frames: BreadcrumbFrame[];
};

type Return = {
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  getLogLevels: () => {label: string; value: string}[];
  items: BreadcrumbFrame[];
  logLevel: string[];
  searchTerm: string;
  setLogLevel: (logLevel: string[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

function getFilterableField(frame: BreadcrumbFrame) {
  if (isConsoleFrame(frame)) {
    const consoleFrame = frame as ConsoleFrame;
    return consoleFrame.level;
  }
  return undefined;
}

const FILTERS = {
  logLevel: (item: BreadcrumbFrame, logLevel: string[]) =>
    logLevel.length === 0 || logLevel.includes(getFilterableField(item) ?? ''),
  searchTerm: (item: BreadcrumbFrame, searchTerm: string) =>
    [
      item.message ?? '',
      ...Array.from((item as ConsoleFrame).data?.arguments ?? []),
    ].some(val => JSON.stringify(val).toLowerCase().includes(searchTerm)),
};

function sortBySeverity(a: string, b: string) {
  const UNKNOWN_LEVEL = 10;
  const levels = {
    issue: 0,
    fatal: 1,
    error: 2,
    warning: 3,
    info: 4,
    debug: 5,
    trace: 6,
  };

  const aRank = levels[a] ?? UNKNOWN_LEVEL;
  const bRank = levels[b] ?? UNKNOWN_LEVEL;
  return aRank - bRank;
}

function useConsoleFilters({frames}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  // Keep a reference of object paths that are expanded (via <StructuredEventData>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  //
  // Note that this is intentionally not in state because we do not want to
  // re-render when items are expanded/collapsed, though it may work in state as well.
  const expandPathsRef = useRef(new Map<number, Set<string>>());

  const logLevel = useMemo(() => decodeList(query.f_c_logLevel), [query.f_c_logLevel]);
  const searchTerm = decodeScalar(query.f_c_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: frames,
        filterFns: FILTERS,
        filterVals: {logLevel, searchTerm},
      }),
    [frames, logLevel, searchTerm]
  );

  const getLogLevels = useCallback(
    () =>
      Array.from(
        new Set(
          frames
            .map(frame => ('level' in frame ? (frame.level as string) : null))
            .concat(logLevel)
        )
      )
        .filter(defined)
        .sort(sortBySeverity)
        .map(value => ({
          value,
          label: value,
        })),
    [frames, logLevel]
  );

  const setLogLevel = useCallback(
    (f_c_logLevel: string[]) => {
      setFilter({f_c_logLevel});
      // Need to reset `expandPaths` when filtering
      expandPathsRef.current = new Map();
    },
    [setFilter, expandPathsRef]
  );

  const setSearchTerm = useCallback(
    (f_c_search: string) => {
      setFilter({f_c_search: f_c_search || undefined});
      // Need to reset `expandPaths` when filtering
      expandPathsRef.current = new Map();
    },
    [setFilter, expandPathsRef]
  );

  return {
    expandPathsRef,
    getLogLevels,
    items,
    logLevel,
    searchTerm,
    setLogLevel,
    setSearchTerm,
  };
}

export default useConsoleFilters;
