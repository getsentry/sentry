import {useMemo} from 'react';
import omit from 'lodash/omit';

import TraceView from 'sentry/components/events/interfaces/spans/traceView';
import {AggregateSpanType} from 'sentry/components/events/interfaces/spans/types';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import {AggregateEventTransaction, EntryType, EventOrGroupType} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type AggregateSpanRow = {
  'avg(absolute_offset)': number;
  'avg(duration)': number;
  'avg(exclusive_time)': number;
  'count()': number;
  description: string;
  group: string;
  is_segment: number;
  node_fingerprint: string;
  parent_node_fingerprint: string;
  start_ms: number;
};

export function useAggregateSpans({transaction}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const endpointOptions = {
    query: {
      transaction,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
    },
  };

  return useApiQuery<{
    data: {[fingerprint: string]: AggregateSpanRow}[];
    meta: any;
  }>(
    [
      `/organizations/${organization.slug}/spans-aggregation/`,
      {
        query: endpointOptions.query,
      },
    ],
    {
      staleTime: Infinity,
      enabled: true,
    }
  );
}

type Props = {
  transaction: string;
};

export function AggregateSpans({transaction}: Props) {
  const organization = useOrganization();
  // const location = useLocation();
  const {data} = useAggregateSpans({transaction});
  // const transactionMethod = location.query.method;

  function formatSpan(span, total) {
    const {
      node_fingerprint: span_id,
      parent_node_fingerprint: parent_span_id,
      description: description,
      'avg(exclusive_time)': exclusive_time,
      'avg(absolute_offset)': start_timestamp,
      'count()': count,
      'avg(duration)': duration,
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
      duration,
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
    };
  }, [parentSpan, flattenedSpans]);
  const waterfallModel = useMemo(() => new WaterfallModel(event, undefined), [event]);

  return (
    <Panel>
      <TraceView
        waterfallModel={waterfallModel}
        organization={organization}
        isEmbedded
        isAggregate
      />
    </Panel>
  );
}
