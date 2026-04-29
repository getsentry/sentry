import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {Location} from 'history';

import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {validateAggregateSort} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
} from 'sentry/views/explore/spans/spansQueryParams';

function isSameLocation(a: Location, b: Location): boolean {
  if (a.pathname !== b.pathname) {
    return false;
  }
  return JSON.stringify(a.query) === JSON.stringify(b.query);
}

interface SpansQueryParamsProviderProps {
  children: ReactNode;
}

export function SpansQueryParamsProvider({children}: SpansQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Store location in a ref so we can access the latest value without including
  // it in the dependency array. This makes setWritableQueryParams stable and
  // prevents unnecessary context updates.
  const locationRef = useRef(location);
  locationRef.current = location;

  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location),
    [location]
  );

  // Self-heal stale URL state in place so that links copied from the address
  // bar (or unfurled in Slack) reflect what the UI is actually showing. The
  // parser already discards stale values, but the URL keeps them around until
  // a user-driven change overwrites them.
  useEffect(() => {
    const cleanedQuery = {...location.query};
    let changed = false;

    // When `aggregateField` is the active source of yAxes/groupBys, the legacy
    // `visualize` and `groupBy` keys are ignored by the parser. Drop them so
    // they can't drift back into shared URLs.
    if (cleanedQuery.aggregateField !== undefined) {
      if (cleanedQuery.visualize !== undefined) {
        delete cleanedQuery.visualize;
        changed = true;
      }
      if (cleanedQuery.groupBy !== undefined) {
        delete cleanedQuery.groupBy;
        changed = true;
      }
    }

    // `aggregateSort` must reference an active yAxis or groupBy. If any entry
    // is stale (e.g. left over from a previous `visualize`), the parser falls
    // back to the default sort but the URL still carries the broken value.
    // Reuse the exact validator the parser uses so the two stay in sync.
    const urlAggregateSort = decodeSorts(cleanedQuery.aggregateSort);
    if (urlAggregateSort.length > 0) {
      const aggregateFields = [...readableQueryParams.aggregateFields];
      const allValid = urlAggregateSort.every(sort =>
        validateAggregateSort(sort, aggregateFields)
      );
      if (!allValid) {
        delete cleanedQuery.aggregateSort;
        changed = true;
      }
    }

    if (changed) {
      navigate({...location, query: cleanedQuery}, {replace: true});
    }
  }, [location, readableQueryParams, navigate]);

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const target = getTargetWithReadableQueryParams(
        locationRef.current,
        writableQueryParams
      );

      // Only navigate if the target URL is different from current location
      // This prevents duplicate history entries which can cause browser back button issues
      if (!isSameLocation(locationRef.current, target)) {
        navigate(target);
      }
    },
    [navigate]
  );

  const isUsingDefaultFields = isDefaultFields(location);

  return (
    <QueryParamsContextProvider
      isUsingDefaultFields={isUsingDefaultFields}
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
      shouldManageFields
    >
      {children}
    </QueryParamsContextProvider>
  );
}
