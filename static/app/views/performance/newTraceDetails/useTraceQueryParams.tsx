import {useMemo} from 'react';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {decodeScalar} from 'sentry/utils/queryString';

export interface TraceViewQueryParams {
  end: string | undefined;
  start: string | undefined;
  statsPeriod: string | undefined;
  timestamp: number | undefined;
  useSpans: number;
}

export function useTraceQueryParams(
  params?: Partial<TraceViewQueryParams>
): TraceViewQueryParams {
  return useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(qs.parse(location.search), {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const timestamp: string | undefined = decodeScalar(normalizedParams.timestamp);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
    const numberTimestamp = timestamp ? Number(timestamp) : undefined;

    return {
      start: start ?? params?.start,
      end: end ?? params?.end,
      statsPeriod: statsPeriod ?? params?.statsPeriod,
      timestamp: numberTimestamp ?? params?.timestamp,
      useSpans: 1,
    };
  }, [params]);
}
