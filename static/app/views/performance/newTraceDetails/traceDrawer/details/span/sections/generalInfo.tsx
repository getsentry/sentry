import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {DateTime} from 'sentry/components/dateTime';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import {Content} from 'sentry/components/keyValueData';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDuration from 'sentry/utils/duration/getDuration';
import getDynamicText from 'sentry/utils/getDynamicText';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {WiderHovercard} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {ModuleName, SpanIndexedField} from 'sentry/views/insights/types';
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
  const span = props.node.value;

  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  const ancestryAndGroupingItems = useSpanAncestryAndGroupingItems({
    node: props.node,
    onParentClick: props.onParentClick,
    location: props.location,
    organization: props.organization,
  });

  if (!hasTraceNewUi) {
    return <LegacyGeneralInfo {...props} />;
  }

  const startTimestamp = props.node.space[0];
  const endTimestamp = props.node.space[0] + props.node.space[1];
  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(
      startTimestamp / 1e3,
      endTimestamp / 1e3
    );
  const projectIds = props.node.event?.projectID;

  const formattedDescription = getFormattedSpanDescription(span);
  let items: SectionCardKeyValueList = [
    {
      key: 'op',
      subject: t('Op'),
      value: span.op,
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={SpanIndexedField.SPAN_OP}
          rowValue={span.op}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    },
    {
      key: 'description',
      subject: t('Description'),
      value: span.description ? (
        resolvedModule === ModuleName.DB ? (
          <WiderHovercard
            position="right"
            body={
              <FullSpanDescription
                group={span.sentry_tags?.group}
                shortDescription={span.description}
                moduleName={ModuleName.DB}
              />
            }
          >
            <DescriptionWrapper>{formattedDescription}</DescriptionWrapper>
          </WiderHovercard>
        ) : (
          formattedDescription
        )
      ) : (
        <EmptyValueContainer>{t('No description')}</EmptyValueContainer>
      ),
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={SpanIndexedField.SPAN_DESCRIPTION}
          rowValue={span.description}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    },
    {
      key: 'duration',
      subject: t('Duration'),
      value: <SpanDuration node={props.node} />,
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={SpanIndexedField.SPAN_DURATION}
          rowValue={getDuration((endTimestamp - startTimestamp) / 1000, 2, true)}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    },
    {
      key: 'start_timestamp',
      subject: t('Start Timestamp'),
      value: getDynamicText({
        fixed: 'Mar 19, 2021 11:06:27 AM UTC',
        value: (
          <Fragment>
            <DateTime date={startTimestamp} />
            {` (${startTimeWithLeadingZero})`}
          </Fragment>
        ),
      }),
    },
    {
      key: 'end_timestamp',
      subject: t('End Timestamp'),
      value: getDynamicText({
        fixed: 'Mar 19, 2021 11:06:28 AM UTC',
        value: (
          <Fragment>
            <DateTime date={endTimestamp} />
            {` (${endTimeWithLeadingZero})`}
          </Fragment>
        ),
      }),
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={SpanIndexedField.TIMESTAMP}
          rowValue={new Date(endTimestamp).toISOString()}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    },
  ];

  if (span.exclusive_time) {
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
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={SpanIndexedField.SPAN_SELF_TIME}
          rowValue={getDuration(span.exclusive_time / 1000, 2, true)}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
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
              organization: props.organization,
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

function getFormattedSpanDescription(span: TraceTree.Span) {
  const rawDescription = span.description;
  if (!rawDescription) {
    return '';
  }

  const formatter = new SQLishFormatter();
  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  if (resolvedModule !== ModuleName.DB) {
    return rawDescription;
  }

  return formatter.toSimpleMarkup(rawDescription);
}

const DescriptionWrapper = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;
