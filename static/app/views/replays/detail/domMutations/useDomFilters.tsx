import {RefObject, useCallback, useMemo, useRef} from 'react';
import {INode} from '@sentry-internal/rrweb-snapshot';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {filterItems} from 'sentry/views/replays/detail/utils';

export type FilterFields = {
  f_d_search: string;
  f_d_type: string[];
};

type Options = {
  actions: Extraction[];
};

type Return = {
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  getMutationsTypes: () => {label: string; value: string}[];
  items: Extraction[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setType: (type: string[]) => void;
  type: string[];
};

// Only Element nodes have `outerHTML`. INode comes from rrweb, it is a `Node`
// with rrweb serialization property `__sn`.
type SerializedElement = Element & Pick<INode, '__sn'>;
function isElement(n: INode): n is SerializedElement {
  return n.nodeType === n.ELEMENT_NODE;
}

const FILTERS = {
  type: (item: Extraction, type: string[]) =>
    type.length === 0 || type.includes(item.crumb.type),

  searchTerm: (item: Extraction, searchTerm: string) =>
    isElement(item.html)
      ? JSON.stringify(item.html.outerHTML).toLowerCase().includes(searchTerm)
      : false,
};

function useDomFilters({actions}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();
  // Keep a reference of object paths that are expanded (via <ObjectInspector>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  //
  // Note that this is intentionally not in state because we do not want to
  // re-render when items are expanded/collapsed, though it may work in state as well.
  const expandPathsRef = useRef(new Map<number, Set<string>>());

  const type = useMemo(() => decodeList(query.f_d_type), [query.f_d_type]);
  const searchTerm = useMemo(
    () => decodeScalar(query.f_d_search, '').toLowerCase(),
    [query.f_d_search]
  );

  const items = useMemo(
    () =>
      filterItems({
        items: actions,
        filterFns: FILTERS,
        filterVals: {type, searchTerm},
      }),
    [actions, type, searchTerm]
  );

  const getMutationsTypes = useCallback(
    () =>
      Array.from(
        new Set(actions.map(mutation => mutation.crumb.type as string).concat(type))
      )
        .sort()
        .map(value => ({
          value,
          label: value,
        })),
    [actions, type]
  );

  const setType = useCallback(
    (f_d_type: string[]) => {
      setFilter({f_d_type});
      expandPathsRef.current = new Map();
    },
    [setFilter]
  );

  const setSearchTerm = useCallback(
    (f_d_search: string) => {
      setFilter({f_d_search: f_d_search || undefined});
      expandPathsRef.current = new Map();
    },
    [setFilter]
  );

  return {
    expandPathsRef,
    getMutationsTypes,
    items,
    searchTerm,
    setSearchTerm,
    setType,
    type,
  };
}

export default useDomFilters;
