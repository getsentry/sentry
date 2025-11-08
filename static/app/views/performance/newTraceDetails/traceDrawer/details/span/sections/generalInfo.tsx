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
import getDuration from 'sentry/utils/duration/getDuration';
import getDynamicText from 'sentry/utils/getDynamicText';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {WiderHovercard} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {
  TraceDrawerComponents,
  type SectionCardKeyValueList,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';

import {useSpanAncestryAndGroupingItems} from './ancestry';

type GeneralnfoProps = {
  location: Location;
  node: SpanNode;
  onParentClick: (node: BaseNode) => void;
  organization: Organization;
};

function SpanDuration({node}: {node: SpanNode}) {
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const duration = endTimestamp - startTimestamp;

  return (
    <TraceDrawerComponents.Duration
      duration={duration}
      baseline={undefined}
      baseDescription={t(
        'Average total time for this span group across the project associated with its parent transaction, over the last 24 hours'
      )}
      node={node}
    />
  );
}

function SpanSelfTime({node}: {node: SpanNode}) {
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const duration = endTimestamp - startTimestamp;

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
      baseline={undefined}
      baseDescription={t(
        'Average self time for this span group across the project associated with its parent transaction, over the last 24 hours'
      )}
      node={node}
    />
  ) : null;
}

export function GeneralInfo(props: GeneralnfoProps) {
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
          rowKey={SpanFields.SPAN_OP}
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
          rowKey={SpanFields.SPAN_DESCRIPTION}
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
          rowKey={SpanFields.SPAN_DURATION}
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
          rowKey={SpanFields.TIMESTAMP}
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
          rowKey={SpanFields.SPAN_SELF_TIME}
          rowValue={getDuration(span.exclusive_time / 1000, 2, true)}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    });
  }

  items = [...items, ...ancestryAndGroupingItems];

  return (
    <InterimSection
      title={t('General')}
      disableCollapsePersistence
      type="trace_transaction_general"
    >
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
  font-size: ${p => p.theme.fontSize.sm};
`;

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
  color: ${p => p.theme.subText};
`;
