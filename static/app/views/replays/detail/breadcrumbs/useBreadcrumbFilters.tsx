import {useCallback, useMemo} from 'react';
import uniq from 'lodash/uniq';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
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

const TYPE_TO_LABEL: Record<string, string> = {
  start: 'Replay Start',
  replay: 'Replay',
  issue: 'Issue',
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
  lcp: 'LCP',
  click: 'User Click',
  keydown: 'KeyDown',
  input: 'Input',
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
  'largest-contentful-paint': 'lcp',
  'ui.click': 'click',
  'ui.keyDown': 'keydown',
  'ui.input': 'input',
};

function typeToLabel(val: string): string {
  return TYPE_TO_LABEL[val] ?? 'Unknown';
}

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

  const items = useMemo(() => {
    // flips OPORCATERGORY_TO_TYPE and prevents overwriting nav entry, nav entry becomes nav: ['navigation','navigation.push']
    const TYPE_TO_OPORCATEGORY = Object.entries(OPORCATEGORY_TO_TYPE).reduce(
      (dict, [key, value]) =>
        dict[value] ? {...dict, [value]: [dict[value], key]} : {...dict, [value]: key},
      {}
    );
    const OpOrCategory = type.map(theType => TYPE_TO_OPORCATEGORY[theType]).flat();
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
          value,
          label: typeToLabel(value),
        })),
    [frames, type]
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
