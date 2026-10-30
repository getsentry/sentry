import {logger} from '@sentry/react';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';
import {defined} from 'sentry/utils/defined';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {encodeSort} from 'sentry/utils/queryString';
import {getIngestDelayFilter} from 'sentry/views/explore/logs/logsIngestDelay';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
} from 'sentry/views/explore/logs/types';
import type {LogAnchor} from 'sentry/views/explore/logs/useLogAnchor';
import {getTimeBasedSortBy} from 'sentry/views/explore/logs/utils';

/**
 * The page param represents a page of log data, we always use the timestamp precise field as timestamp is too inaccurate for high resolution logs.
 * Pages are represented by a window of time using the precise timestamp of either it's most recent or oldest row, depending on sort direction and which page we're fetching.
 * We will overlap pages on the nanosecond boundary (using => and <=) because events can happen on the same timestamp.
 */
export function getLogPageParam(
  pageDirection: 'previous' | 'next',
  sortBys: Sort[],
  autoRefresh: boolean,
  highFidelity?: boolean
) {
  const isGetPreviousPage = pageDirection === 'previous';
  // oxlint-disable-next-line react/function-component-definition -- This callback is not a React component.
  return (
    result: ApiResponse<EventsLogsResult>,
    _: unknown,
    pageParam: LogPageParam
  ): LogPageParam => {
    const pageData = result.json;
    const sortBy = getTimeBasedSortBy(sortBys);

    if (!sortBy) {
      // Only sort by timestamp precise is supported for infinite queries.
      return null;
    }

    const isDescending = sortBy.kind === 'desc';
    // Previous pages have to have the sort order reversed in order to start at the limit from the initial page.
    const querySortDirection: Sort | undefined = isGetPreviousPage
      ? {
          field: OurLogKnownFieldKey.TIMESTAMP,
          kind: isDescending ? 'asc' : 'desc',
        }
      : undefined;

    if (highFidelity || isFlexTimePageParam(pageParam)) {
      const links = parseLinkHeader(result.headers.Link ?? null);
      const link = isGetPreviousPage ? links.previous : links.next;

      if (!link?.results) {
        return undefined;
      }

      return {
        querySortDirection,
        sortByDirection: sortBy.kind,
        autoRefresh,
        cursor: link.cursor ?? undefined,
      };
    }

    const firstRow = pageData.data?.[0];
    const lastRow = pageData.data?.[pageData.data.length - 1];
    if (!firstRow || !lastRow) {
      // No data to paginate, this should not happen as empty pages are removed from the query client.
      // If this does happen, it will stop the infinite query from fetching more pages as "hasNextPage" will be false.
      return pageParam;
    }

    let firstTimestamp: bigint;
    let lastTimestamp: bigint;
    try {
      firstTimestamp = BigInt(firstRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
      lastTimestamp = BigInt(lastRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
    } catch {
      logger.warn('No timestamp precise found for log row, using timestamp instead', {
        logId: firstRow[OurLogKnownFieldKey.ID],
        timestamp: firstRow[OurLogKnownFieldKey.TIMESTAMP],
        timestampPrecise: firstRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE],
      });
      firstTimestamp =
        BigInt(new Date(firstRow[OurLogKnownFieldKey.TIMESTAMP]).getTime()) * 1_000_000n;
      lastTimestamp =
        BigInt(new Date(lastRow[OurLogKnownFieldKey.TIMESTAMP]).getTime()) * 1_000_000n;
    }

    const logId = isGetPreviousPage
      ? firstRow[OurLogKnownFieldKey.ID]
      : lastRow[OurLogKnownFieldKey.ID];
    const timestampPrecise = isGetPreviousPage ? firstTimestamp : lastTimestamp;

    const indexFromInitialPage = isGetPreviousPage
      ? (pageParam?.indexFromInitialPage ?? 0) - 1
      : (pageParam?.indexFromInitialPage ?? 0) + 1;

    const pageParamResult: InfiniteScrollPageParam = {
      logId,
      timestampPrecise,
      querySortDirection,
      sortByDirection: sortBy.kind,
      indexFromInitialPage,
      autoRefresh,
    };

    return pageParamResult;
  };
}

const JSON_NUMBER_NANOSECOND_ROUNDING = 256n;

/**
 * Creates an initial page param for autoRefresh mode that enforces the MAX_LOG_INGEST_DELAY condition.
 * This ensures the first page query filters for logs older than Date.now() - MAX_LOG_INGEST_DELAY
 * which means the next logs page fetched will have results instead of having to wait for the MAX_LOG_INGEST_DELAY to pass.
 */
export function getInitialLogPageParam(
  autoRefresh: boolean,
  sortBys: readonly Sort[],
  anchor: LogAnchor | undefined
): LogPageParam {
  if (!autoRefresh && !anchor) {
    return null;
  }

  const sortBy = getTimeBasedSortBy(sortBys);
  if (!sortBy) {
    // Only sort by timestamp precise is supported for infinite queries.
    return null;
  }

  if (anchor) {
    return {
      anchored: true,
      autoRefresh,
      indexFromInitialPage: 0,
      logId: '',
      sortByDirection: sortBy.kind,
      timestampPrecise:
        sortBy.kind === 'desc'
          ? anchor.timestampPrecise + JSON_NUMBER_NANOSECOND_ROUNDING
          : anchor.timestampPrecise - JSON_NUMBER_NANOSECOND_ROUNDING,
    };
  }

  const pageParamResult: LogPageParam = {
    // Use an empty logId since we don't have a specific log to exclude yet
    logId: '',
    timestampPrecise: null,
    sortByDirection: sortBy.kind,
    indexFromInitialPage: 0,
    // No need to override query sort direction for initial page
    querySortDirection: undefined,
    autoRefresh,
  };

  return pageParamResult;
}

export function getParamBasedQuery(
  query: QueryKeyEndpointOptions['query'],
  pageParam: LogPageParam
) {
  if (!pageParam) {
    return query;
  }

  if (isFlexTimePageParam(pageParam)) {
    return {
      ...query,
      cursor: pageParam.cursor,
    };
  }

  const comparison =
    (pageParam.querySortDirection?.kind ?? pageParam.sortByDirection) === 'asc'
      ? '>='
      : '<=';

  const filter = pageParam.timestampPrecise
    ? `${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:${comparison}${pageParam.timestampPrecise}`
    : '';

  const ingestDelayFilter = pageParam.autoRefresh ? getIngestDelayFilter() : '';
  // Only add the logId exclusion filter if we have a valid logId from the previous page.
  const logIdFilter = pageParam.logId
    ? ` !${OurLogKnownFieldKey.ID}:${pageParam.logId}`
    : '';

  return {
    ...query,
    query: [filter + logIdFilter + ingestDelayFilter, query?.query]
      .filter(Boolean)
      .join(' AND '),
    sort: pageParam.querySortDirection
      ? encodeSort(pageParam.querySortDirection)
      : query?.sort,
  };
}

interface BaseLogsPageParams {
  // Whether the page param is for auto refresh mode.
  autoRefresh: boolean;
  // The original sort direction of the query.
  sortByDirection: Sort['kind'];
  // When scrolling is happening towards current time, or during auto refresh, we flip the sort direction passed to the query to get X more rows in the future starting from the last seen row.
  querySortDirection?: Sort;
}

interface FlexTimePageParam extends BaseLogsPageParams {
  cursor: string | undefined;
}

interface InfiniteScrollPageParam extends BaseLogsPageParams {
  // The index of the page from the initial page. Useful for debugging and testing.
  indexFromInitialPage: number;
  // The id of the log row matching timestampPrecise. We use this to exclude the row from the query to avoid duplicates right on the nanosecond boundary.
  logId: string;
  timestampPrecise: bigint | null;
  anchored?: true;
}

export type LogPageParam = FlexTimePageParam | InfiniteScrollPageParam | null | undefined;

export function isAnchoredPageParam(
  pageParam: LogPageParam
): pageParam is InfiniteScrollPageParam {
  return defined(pageParam) && 'anchored' in pageParam;
}

function isFlexTimePageParam(pageParam: LogPageParam): pageParam is FlexTimePageParam {
  return defined(pageParam) && 'cursor' in pageParam;
}
