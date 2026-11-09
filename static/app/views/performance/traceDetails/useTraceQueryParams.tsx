import {useMemo} from 'react';
import {createLoader, parseAsString} from 'nuqs';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {decodeScalar} from 'sentry/utils/queryString';
import {parseAsRawList} from 'sentry/views/explore/queryParams/parsers';

// Every key normalizeDateTimeParams reads for start/end/statsPeriod, as lists so it can skip invalid repeats.
export const traceDateTimeParsers = {
  end: parseAsRawList,
  pageEnd: parseAsRawList,
  pageStart: parseAsRawList,
  pageStatsPeriod: parseAsRawList,
  period: parseAsRawList,
  start: parseAsRawList,
  statsPeriod: parseAsRawList,
};

const loadTraceViewQueryParams = createLoader({
  ...traceDateTimeParsers,
  timestamp: parseAsString,
});

export interface TraceViewQueryParams {
  end: string | undefined;
  start: string | undefined;
  statsPeriod: string | undefined;
  timestamp: number | undefined;
}

export function useTraceQueryParams(
  params?: Partial<TraceViewQueryParams>
): TraceViewQueryParams {
  return useMemo(() => {
    const {timestamp, ...dateTimeParams} = loadTraceViewQueryParams(location.search);
    const normalizedParams = normalizeDateTimeParams(dateTimeParams, {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
    const numberTimestamp =
      timestamp && !isNaN(Number(timestamp)) ? Number(timestamp) : undefined;

    return {
      start: start ?? params?.start,
      end: end ?? params?.end,
      statsPeriod: statsPeriod ?? params?.statsPeriod,
      timestamp: numberTimestamp ?? params?.timestamp,
    };
  }, [params]);
}
