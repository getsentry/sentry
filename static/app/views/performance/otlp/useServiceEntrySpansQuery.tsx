import type {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Options = {
  query: string;
  sort: Sort;
};

const LIMIT = 5;
const CURSOR_NAME = 'serviceEntrySpansCursor';

export function useServiceEntrySpansQuery({query, sort}: Options) {
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );
  const cursor = decodeScalar(location.query?.[CURSOR_NAME]);

  const {data, isLoading, pageLinks, meta, error} = useEAPSpans(
    {
      search: query,
      fields: [
        'span_id',
        'user.id',
        'user.email',
        'user.username',
        'user.ip',
        'span.duration',
        'trace',
        'timestamp',
        'replayId',
        'profile.id',
        'profiler.id',
        'thread.id',
        'precise.start_ts',
        'precise.finish_ts',
      ],
      sorts: [sort],
      limit: LIMIT,
      cursor,
    },
    'api.performance.service-entry-spans-table',
    true
  );

  return {
    data,
    isLoading,
    pageLinks,
    meta,
    error,
  };
}
