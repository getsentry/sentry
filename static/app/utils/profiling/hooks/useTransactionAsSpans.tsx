import {useEffect, useEffectEvent, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import type {PageFilters} from 'sentry/types/core';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';

export type TransactionResult = ReturnType<typeof useTransactionAsSpans>;
export type TransactionSpan = NonNullable<TransactionResult['data']['transactionSpan']>;

type UseTransactionProps = {
  projectIds: number[];
  enabled?: boolean;
  end?: number;
  start?: number;
  traceId?: string;
  transactionEventId?: string;
  transactionSpanId?: string;
};

export function useTransactionAsSpans({
  projectIds,
  transactionEventId,
  transactionSpanId,
  traceId,
  start,
  end,
  enabled,
}: UseTransactionProps) {
  const search = useMemo(() => {
    const s = new MutableSearch('');
    if (transactionSpanId) {
      s.setFilterValues(SpanFields.TRANSACTION_SPAN_ID, [transactionSpanId]);
    } else if (transactionEventId) {
      s.setFilterValues(SpanFields.TRANSACTION_EVENT_ID, [transactionEventId]);
    } else {
      return;
    }
    if (traceId) {
      s.setFilterValues(SpanFields.TRACE, [traceId]);
    }
    return s;
  }, [transactionEventId, transactionSpanId, traceId]);

  const result = useSpans(
    {
      search,
      limit: 1000,
      fields: [
        SpanFields.TRACE,
        SpanFields.SPAN_ID,
        SpanFields.IS_TRANSACTION,
        SpanFields.SPAN_OP,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.TRACE_STATUS,
        SpanFields.PRECISE_START_TS,
        SpanFields.PRECISE_FINISH_TS,
        SpanFields.SPAN_SELF_TIME,
        SpanFields.SDK_NAME,
        SpanFields.TRACE_PARENT_SPAN,
        SpanFields.TRANSACTION_EVENT_ID,
        SpanFields.RELEASE,
        SpanFields.ENVIRONMENT,
        SpanFields.OS_NAME,
        SpanFields.OS_VERSION,
        SpanFields.DEVICE_MODEL,
        SpanFields.DEVICE_MANUFACTURER,
      ],
      sorts: [
        {
          field: SpanFields.PRECISE_START_TS,
          kind: 'asc',
        },
      ],
      pageFilters: startEndToPageFilters({start, end, projectIds}),
      queryWithoutPageFilters: true,
      // We're querying by specific IDs here and need complete results, so we
      // can't accept downsampling. The time bounds are already set to the
      // length of the transaction or profile, so the amount of data we're
      // scanning should be relatively limited.
      samplingMode: 'HIGHEST_ACCURACY',
      enabled: enabled && !!search && start !== undefined && end !== undefined,
    },
    'api.profiles.transaction'
  );
  const transactionSpan = useMemo(
    () => result.data.find(row => row[SpanFields.IS_TRANSACTION]),
    [result.data]
  );
  const childSpans = useMemo(
    () => result.data.filter(row => !row[SpanFields.IS_TRANSACTION]),
    [result.data]
  );

  const logMissingTransactionSpan = useEffectEvent(() => {
    if (transactionSpan) {
      return;
    }
    Sentry.logger.error('Failed to load transaction span for profile', {
      transactionEventId,
      transactionSpanId,
      traceId,
      start,
      end,
      projectIds,
      numFoundChildSpans: childSpans.length,
    });
  });

  useEffect(() => {
    if (result.dataUpdatedAt > 0) {
      logMissingTransactionSpan();
    }
  }, [result.dataUpdatedAt]);

  return {
    ...result,
    data: {
      childSpans,
      transactionSpan,
    },
  };
}

const PADDING_SECONDS = 60; // 1 minute

function startEndToPageFilters({
  start,
  end,
  projectIds,
}: {
  projectIds: number[];
  end?: number;
  start?: number;
}): PageFilters {
  return {
    datetime: {
      start: start === undefined ? null : new Date((start - PADDING_SECONDS) * 1000),
      end: end === undefined ? null : new Date((end + PADDING_SECONDS) * 1000),
      period: null,
      utc: true,
    },
    environments: [],
    projects: projectIds,
  };
}
