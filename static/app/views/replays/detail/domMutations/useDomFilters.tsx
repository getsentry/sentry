import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import {useLocation} from 'sentry/utils/useLocation';
import {filterItems} from 'sentry/views/replays/detail/utils';

type Options = {
  actions: Extraction[];
};

type Return = {
  items: Extraction[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setType: (type: {value: string}[]) => void;
  type: string[];
};

const FILTERS = {
  type: (item: Extraction, type: string[]) =>
    type.length === 0 || type.includes(item.crumb.type),

  searchTerm: (item: Extraction, searchTerm: string) =>
    JSON.stringify(item.html).toLowerCase().includes(searchTerm),
};

function useDomFilters({actions}: Options): Return {
  const {pathname, query} = useLocation();

  /* eslint-disable react-hooks/exhaustive-deps */
  const stringyType = JSON.stringify(query.domType);
  const type = useMemo(() => decodeList(query.domType), [stringyType]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const searchTerm = decodeScalar(query.domSearch, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: actions,
        filterFns: FILTERS,
        filterVals: {type, searchTerm},
      }),
    [actions, type, searchTerm]
  );

  const setType = useCallback(
    (domType: {value: string}[]) => {
      browserHistory.push({
        pathname,
        query: {...query, domType: domType.map(_ => _.value)},
      });
    },
    [pathname, query]
  );

  const setSearchTerm = useCallback(
    (domSearch: string) => {
      browserHistory.push({
        pathname,
        query: {...query, domSearch: domSearch ? domSearch : undefined},
      });
    },
    [pathname, query]
  );

  return {
    items,
    searchTerm,
    setSearchTerm,
    setType,
    type,
  };
}

export default useDomFilters;
