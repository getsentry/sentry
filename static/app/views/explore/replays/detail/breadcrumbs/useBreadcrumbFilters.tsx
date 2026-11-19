import type {RefObject} from 'react';
import {useCallback, useMemo, useRef} from 'react';

import {uniq} from 'sentry/utils/array/uniq';
import {decodeScalar} from 'sentry/utils/queryString';
import {
  BREADCRUMB_TYPE_LABELS as TYPE_TO_LABEL,
  type BreadcrumbType,
} from 'sentry/utils/replays/breadcrumbTypes';
import {useFiltersInLocationQuery} from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {filterItems} from 'sentry/views/explore/replays/detail/utils';

type Options = {
  frames: ReplayFrame[];
};

type Return = {
  clearAllFilters: () => void;
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  getBreadcrumbTypes: () => Array<{label: string; value: BreadcrumbType}>;
  items: ReplayFrame[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setType: (type: BreadcrumbType[]) => void;
  type: BreadcrumbType[];
};

const OPORCATEGORY_TO_TYPE: Record<string, BreadcrumbType> = {
  'replay.init': 'start',
  'replay.mutations': 'replay',
  issue: 'issue',
  console: 'console',
  navigation: 'nav',
  'navigation.push': 'nav',
  'navigation.navigate': 'pageLoad',
  'navigation.reload': 'reload',
  'navigation.back_forward': 'navBackForward',
  memory: 'memory',
  paint: 'paint',
  'ui.blur': 'blur',
  'ui.focus': 'action',
  'ui.multiClick': 'rageOrMulti',
  'ui.slowClickDetected': 'rageOrDead',
  'replay.hydrate-error': 'hydrateError',
  'web-vital': 'webVital',
  'ui.click': 'click',
  'ui.tap': 'tap',
  'ui.swipe': 'swipe',
  'ui.scroll': 'scroll',
  'ui.keyDown': 'keydown',
  'ui.input': 'input',
  feedback: 'feedback',
  'device.battery': 'device',
  'device.connectivity': 'device',
  'device.orientation': 'device',
  'app.foreground': 'app',
  'app.background': 'app',
};

const FILTERS = {
  type: (item: ReplayFrame, type: string[]) =>
    type.length === 0 || type.includes(getFrameOpOrCategory(item)),
  searchTerm: (item: ReplayFrame, searchTerm: string) =>
    JSON.stringify(item).toLowerCase().includes(searchTerm),
};

export function useBreadcrumbFilters({frames}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery();

  // Keep a reference of object paths that are expanded (via <StructuredEventData>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  //
  // Note that this is intentionally not in state because we do not want to
  // re-render when items are expanded/collapsed, though it may work in state as well.
  const expandPathsRef = useRef(new Map<number, Set<string>>());

  const searchTerm = decodeScalar(query.f_b_search, '').toLowerCase();

  // add custom breadcrumbs to filter
  frames.forEach(frame => {
    if (!(getFrameOpOrCategory(frame) in OPORCATEGORY_TO_TYPE)) {
      // oxlint-disable-next-line react/immutability
      OPORCATEGORY_TO_TYPE[getFrameOpOrCategory(frame)] = 'custom';
    }
  });

  const type = query.f_b_type;

  const items = useMemo(() => {
    // flips OPORCATERGORY_TO_TYPE and prevents overwriting nav entry, nav entry becomes nav: ['navigation','navigation.push']
    const TYPE_TO_OPORCATEGORY = Object.entries(OPORCATEGORY_TO_TYPE).reduce(
      (dict, [key, value]) =>
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        dict[value]
          ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            {...dict, [value]: [dict[value], key].flat()}
          : {...dict, [value]: key},
      {}
    );
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const OpOrCategory = type.flatMap(theType => TYPE_TO_OPORCATEGORY[theType]);
    return filterItems({
      items: frames,
      filterFns: FILTERS,
      filterVals: {
        type: OpOrCategory,
        searchTerm,
      },
    });
  }, [frames, type, searchTerm]);

  const getBreadcrumbTypes = useCallback(
    () =>
      uniq(
        frames
          .map(frame => OPORCATEGORY_TO_TYPE[getFrameOpOrCategory(frame)])
          .concat(type)
      )
        .sort()
        .map(value => ({
          value: value!,
          label: TYPE_TO_LABEL[value!],
        })),
    [frames, type]
  );

  const setType = useCallback(
    (f_b_type: BreadcrumbType[]) => setFilter({f_b_type}),
    [setFilter]
  );

  const setSearchTerm = useCallback(
    (f_b_search: string) => setFilter({f_b_search: f_b_search || undefined}),
    [setFilter]
  );

  const clearAllFilters = useCallback(
    () => setFilter({f_b_type: undefined, f_b_search: undefined}),
    [setFilter]
  );

  return {
    clearAllFilters,
    expandPathsRef,
    getBreadcrumbTypes,
    items,
    searchTerm,
    setSearchTerm,
    setType,
    type,
  };
}
