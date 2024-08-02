import type {Location} from 'history';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {ModuleName} from 'sentry/views/insights/types';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

import {getSpanAncestryAndGroupingItems} from './ancestry';

type GeneralnfoProps = {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
};

function SpanDuration({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const duration = endTimestamp - startTimestamp;
  const averageSpanDuration: number | undefined =
    span['span.averageResults']?.['avg(span.duration)'];

  return (
    <TraceDrawerComponents.Duration
      duration={duration}
      baseline={averageSpanDuration ? averageSpanDuration / 1000 : undefined}
      baseDescription={t(
        'Average total time for this span group across the project associated with its parent transaction, over the last 24 hours'
      )}
    />
  );
}

function SpanSelfTime({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const duration = endTimestamp - startTimestamp;
  const averageSpanSelfTime: number | undefined =
    span['span.averageResults']?.['avg(span.self_time)'];

  return span.exclusive_time ? (
    <TraceDrawerComponents.Duration
      ratio={span.exclusive_time / 1000 / duration}
      duration={span.exclusive_time / 1000}
      baseline={averageSpanSelfTime ? averageSpanSelfTime / 1000 : undefined}
      baseDescription={t(
        'Average self time for this span group across the project associated with its parent transaction, over the last 24 hours'
      )}
    />
  ) : null;
}

export function GeneralInfo(props: GeneralnfoProps) {
  let items: SectionCardKeyValueList = [];

  const span = props.node.value;
  const {event} = span;
  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  const hasNewSpansUIFlag =
    props.organization.features.includes('performance-spans-new-ui') &&
    props.organization.features.includes('insights-initial-modules');

  // The new spans UI relies on the group hash assigned by Relay, which is different from the hash available on the span itself.
  const groupHash = hasNewSpansUIFlag ? span.sentry_tags?.group ?? '' : span.hash ?? '';

  if (
    ![ModuleName.DB, ModuleName.RESOURCE].includes(resolvedModule) &&
    span.description
  ) {
    items.push({
      key: 'description',
      subject: t('Description'),
      value:
        span.op && span.hash ? (
          <TraceDrawerComponents.CopyableCardValueWithLink
            value={span.description}
            linkTarget={spanDetailsRouteWithQuery({
              orgSlug: props.organization.slug,
              transaction: event.title,
              query: props.location.query,
              spanSlug: {op: span.op, group: groupHash},
              projectID: event.projectID,
            })}
            linkText={t('View Similar Spans')}
            onClick={() =>
              trackAnalytics('trace.trace_layout.view_similar_spans', {
                organization: props.organization,
                module: resolvedModule,
                source: 'general_info',
              })
            }
          />
        ) : (
          <TraceDrawerComponents.CopyableCardValueWithLink value={span.description} />
        ),
    });
  }

  items.push({
    key: 'duration',
    subject: t('Duration'),
    value: <SpanDuration node={props.node} />,
  });

  if (props.node.value.exclusive_time) {
    items.push({
      key: 'self_time',
      subject: t('Self Time'),
      subjectNode: (
        <TraceDrawerComponents.FlexBox style={{gap: '5px'}}>
          {t('Self Time')}
          <QuestionTooltip
            title={t('Applicable to the children of this event only')}
            size="xs"
          />
        </TraceDrawerComponents.FlexBox>
      ),
      value: <SpanSelfTime node={props.node} />,
    });
  }

  const ancestryAndGroupingItems = getSpanAncestryAndGroupingItems({
    node: props.node,
    onParentClick: props.onParentClick,
    location: props.location,
    organization: props.organization,
  });

  items = [...items, ...ancestryAndGroupingItems];

  return (
    <TraceDrawerComponents.SectionCard
      disableTruncate
      items={items}
      title={t('General')}
    />
  );
}
