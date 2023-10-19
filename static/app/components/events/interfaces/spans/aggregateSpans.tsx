import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Alert from 'sentry/components/alert';
import TraceView from 'sentry/components/events/interfaces/spans/traceView';
import {AggregateSpanType} from 'sentry/components/events/interfaces/spans/types';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AggregateEventTransaction, EntryType, EventOrGroupType} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type SpanSamples = Array<[string, string]>;

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
  samples: SpanSamples;
  start_ms: number;
};

export function useAggregateSpans({
  transaction,
  httpMethod,
}: {
  transaction: string;
  httpMethod?: string;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const endpointOptions = {
    query: {
      transaction,
      ...(defined(httpMethod) ? {'http.method': httpMethod} : null),
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
  httpMethod?: string;
};

export function AggregateSpans({transaction, httpMethod}: Props) {
  const organization = useOrganization();
  const {data, isLoading} = useAggregateSpans({transaction, httpMethod});

  const [isBannerOpen, setIsBannerOpen] = useLocalStorageState<boolean>(
    'aggregate-waterfall-info-banner',
    true
  );

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
  const waterfallModel = useMemo(() => new WaterfallModel(event, undefined), [event]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      {isBannerOpen && (
        <StyledAlert
          type="info"
          showIcon
          trailingItems={<StyledCloseButton onClick={() => setIsBannerOpen(false)} />}
        >
          {tct(
            'This is an aggregate view across [x] events. You can see how frequent each span appears in the aggregate and identify any outliers.',
            {x: event.count}
          )}
        </StyledAlert>
      )}
      <Panel>
        <TraceView
          waterfallModel={waterfallModel}
          organization={organization}
          isEmbedded
          isAggregate
        />
      </Panel>
    </Fragment>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;

const StyledCloseButton = styled(IconClose)`
  cursor: pointer;
`;
