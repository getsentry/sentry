import type {RefObject} from 'react';
import {useCallback, useMemo, useRef} from 'react';
import * as Sentry from '@sentry/react';

import {uniq} from 'sentry/utils/array/uniq';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {filterItems} from 'sentry/views/replays/detail/utils';

export type FilterFields = {
  f_b_search: string;
  f_b_type: string[];
};

type Options = {
  frames: ReplayFrame[];
};

type Return = {
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  getBreadcrumbTypes: () => {label: string; value: string}[];
  items: ReplayFrame[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setType: (type: string[]) => void;
  type: string[];
};

const TYPE_TO_LABEL: Record<string, string> = {
  start: 'Replay Start',
  feedback: 'User Feedback',
  replay: 'Replay',
  issue: 'Error',
  console: 'Console',
  nav: 'Navigation',
  pageLoad: 'Page Load',
  reload: 'Reload',
  navBackForward: 'Navigate Back/Forward',
  memory: 'Memory',
  paint: 'Paint',
  blur: 'User Blur',
  action: 'User Action',
  rageOrMulti: 'Rage & Multi Click',
  rageOrDead: 'Rage & Dead Click',
  hydrateError: 'Hydration Error',
  webVital: 'Web Vital',
  click: 'User Click',
  keydown: 'KeyDown',
  input: 'Input',
  tap: 'User Tap',
  swipe: 'User Swipe',
  device: 'Device',
  app: 'App',
  custom: 'Custom',
};

const OPORCATEGORY_TO_TYPE: Record<string, keyof typeof TYPE_TO_LABEL> = {
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
  'ui.keyDown': 'keydown',
  'ui.input': 'input',
  feedback: 'feedback',
  'device.battery': 'device',
  'device.connectivity': 'device',
  'device.orientation': 'device',
  'app.foreground': 'app',
  'app.background': 'app',
};

function typeToLabel(val: string): string {
  if (TYPE_TO_LABEL[val]) {
    return TYPE_TO_LABEL[val];
  }
  Sentry.captureException('Unknown breadcrumb filter type');
  return 'Unknown';
}

const FILTERS = {
  type: (item: ReplayFrame, type: string[]) =>
    type.length === 0 || type.includes(getFrameOpOrCategory(item)),
  searchTerm: (item: ReplayFrame, searchTerm: string) =>
    JSON.stringify(item).toLowerCase().includes(searchTerm),
};

function useBreadcrumbFilters({frames}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  // Keep a reference of object paths that are expanded (via <StructuredEventData>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  //
  // Note that this is intentionally not in state because we do not want to
  // re-render when items are expanded/collapsed, though it may work in state as well.
  const expandPathsRef = useRef(new Map<number, Set<string>>());

  const type = useMemo(() => decodeList(query.f_b_type), [query.f_b_type]);
  const searchTerm = decodeScalar(query.f_b_search, '').toLowerCase();

  // add custom breadcrumbs to filter
  frames.forEach(frame => {
    if (!(getFrameOpOrCategory(frame) in OPORCATEGORY_TO_TYPE)) {
      OPORCATEGORY_TO_TYPE[getFrameOpOrCategory(frame)] = 'custom';
    }
  });

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
          label: typeToLabel(value!),
        })),
    [frames, type]
  );

  const setType = useCallback((f_b_type: string[]) => setFilter({f_b_type}), [setFilter]);

  const setSearchTerm = useCallback(
    (f_b_search: string) => setFilter({f_b_search: f_b_search || undefined}),
    [setFilter]
  );

  return {
    expandPathsRef,
    getBreadcrumbTypes,
    items,
    searchTerm,
    setSearchTerm,
    setType,
    type,
  };
}

export default useBreadcrumbFilters;
