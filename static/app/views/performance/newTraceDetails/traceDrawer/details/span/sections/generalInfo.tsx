import styled from '@emotion/styled';
import type {Location} from 'history';

import {Content} from 'sentry/components/keyValueData';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDuration from 'sentry/utils/duration/getDuration';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {ModuleName} from 'sentry/views/insights/types';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

import type {TraceTree} from '../../../../traceModels/traceTree';
import type {TraceTreeNode} from '../../../../traceModels/traceTreeNode';
import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

import {useSpanAncestryAndGroupingItems} from './ancestry';

type GeneralnfoProps = {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
};

function SpanDuration({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const hasNewTraceUi = useHasTraceNewUi();
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const duration = endTimestamp - startTimestamp;
  const averageSpanDuration: number | undefined =
    span['span.averageResults']?.['avg(span.duration)'];
  const baseline =
    !hasNewTraceUi && averageSpanDuration ? averageSpanDuration / 1000 : undefined;

  return (
    <TraceDrawerComponents.Duration
      duration={duration}
      baseline={baseline}
      baseDescription={t(
        'Average total time for this span group across the project associated with its parent transaction, over the last 24 hours'
      )}
      node={node}
    />
  );
}

function SpanSelfTime({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const hasNewTraceUi = useHasTraceNewUi();
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const duration = endTimestamp - startTimestamp;

  const averageSpanSelfTime: number | undefined =
    span['span.averageResults']?.['avg(span.self_time)'];
  const baseline = hasNewTraceUi
    ? undefined
    : averageSpanSelfTime
      ? averageSpanSelfTime / 1000
      : undefined;

  if (
    duration &&
    span.exclusive_time &&
    getDuration(duration, 2, true) === getDuration(span.exclusive_time / 1000, 2, true)
  ) {
    return t('Same as duration');
  }

  return span.exclusive_time ? (
    <TraceDrawerComponents.Duration
      ratio={span.exclusive_time / 1000 / duration}
      duration={span.exclusive_time / 1000}
      baseline={baseline}
      baseDescription={t(
        'Average self time for this span group across the project associated with its parent transaction, over the last 24 hours'
      )}
      node={node}
    />
  ) : null;
}

export function GeneralInfo(props: GeneralnfoProps) {
  const hasTraceNewUi = useHasTraceNewUi();

  const ancestryAndGroupingItems = useSpanAncestryAndGroupingItems({
    node: props.node,
    onParentClick: props.onParentClick,
    location: props.location,
    organization: props.organization,
  });

  if (!hasTraceNewUi) {
    return <LegacyGeneralInfo {...props} />;
  }

  let items: SectionCardKeyValueList = [];

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

  items = [...items, ...ancestryAndGroupingItems];

  return (
    <InterimSection title={t('General')} initialCollapse type="trace_transaction_general">
      <ContentWrapper>
        {items.map(item => (
          <Content key={item.key} item={item} />
        ))}
      </ContentWrapper>
    </InterimSection>
  );
}

const ContentWrapper = styled('div')`
  display: grid;
  column-gap: ${space(1.5)};
  grid-template-columns: fit-content(50%) 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
`;

function LegacyGeneralInfo(props: GeneralnfoProps) {
  let items: SectionCardKeyValueList = [];

  const span = props.node.value;
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
              transaction: props.node.event?.title ?? '',
              query: props.location.query,
              spanSlug: {op: span.op, group: groupHash},
              projectID: props.node.event?.projectID,
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

  const ancestryAndGroupingItems = useSpanAncestryAndGroupingItems({
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
