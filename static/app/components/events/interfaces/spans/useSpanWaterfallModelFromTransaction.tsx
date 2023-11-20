import {useMemo} from 'react';
import omit from 'lodash/omit';

import {useAggregateSpans} from 'sentry/components/events/interfaces/spans/aggregateSpans';
import {AggregateSpanType} from 'sentry/components/events/interfaces/spans/types';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import {AggregateEventTransaction, EntryType, EventOrGroupType} from 'sentry/types';
import {defined} from 'sentry/utils';

export function useSpanWaterfallModelFromTransaction(
  transaction: string,
  httpMethod?: string
) {
  const {data, isLoading} = useAggregateSpans({transaction, httpMethod});
  function formatSpan(span, total) {
    const {
      node_fingerprint: span_id,
      parent_node_fingerprint: parent_span_id,
      description: description,
      'avg(exclusive_time)': exclusive_time,
      'avg(absolute_offset)': start_timestamp,
      'count()': count,
      'avg(duration)': duration,
      samples,
      ...rest
    } = span;
    return {
      ...rest,
      span_id,
      parent_span_id,
      description,
      exclusive_time,
      timestamp: (start_timestamp + duration) / 1000,
      start_timestamp: start_timestamp / 1000,
      trace_id: '1', // not actually trace_id just a placeholder
      count,
      total,
      duration,
      samples,
      frequency: count / total,
      type: 'aggregate',
    };
  }

  const totalCount: number = useMemo(() => {
    if (defined(data)) {
      const spans = Object.values(data);
      for (let index = 0; index < spans.length; index++) {
        if (spans[index].is_segment) {
          return spans[index]['count()'];
        }
      }
    }
    return 0;
  }, [data]);

  const spanList: AggregateSpanType[] = useMemo(() => {
    const spanList_: AggregateSpanType[] = [];
    if (defined(data)) {
      const spans = Object.values(data);
      for (let index = 0; index < spans.length; index++) {
        const node = formatSpan(spans[index], totalCount);
        if (node.is_segment === 1) {
          spanList_.unshift(node);
        } else {
          spanList_.push(node);
        }
      }
    }
    return spanList_;
  }, [data, totalCount]);

  const [parentSpan, ...flattenedSpans] = spanList;

  const hiddenSpans = useMemo(() => {
    const hiddenSpans_ = new Set(
      spanList
        .filter(span => {
          return span.frequency < 0.3;
        })
        .map(span => span.span_id)
    );
    return hiddenSpans_;
  }, [spanList]);

  const event: AggregateEventTransaction = useMemo(() => {
    return {
      contexts: {
        trace: {
          ...omit(parentSpan, 'type'),
        },
      },
      endTimestamp: 0,
      entries: [
        {
          data: flattenedSpans,
          type: EntryType.SPANS,
        },
      ],
      startTimestamp: 0,
      type: EventOrGroupType.AGGREGATE_TRANSACTION,
      // TODO: No need for optional chaining here, we should not return anything if the event is not loaded
      frequency: parentSpan?.frequency ?? 0,
      count: parentSpan?.count ?? 0,
      total: parentSpan?.total ?? 0,
    };
  }, [parentSpan, flattenedSpans]);
  const waterfallModel = useMemo(
    () => new WaterfallModel(event, undefined, undefined, hiddenSpans),
    [event, hiddenSpans]
  );
  return {waterfallModel, event, isLoading};
}
