import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {DateTime} from 'sentry/components/dateTime';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import {Content} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {SpanMetricsResponse} from 'sentry/views/insights/types';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {
  type SectionCardKeyValueList,
  TraceDrawerComponents,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';

type GeneralInfoProps = {
  cacheMetrics: Array<
    Pick<SpanMetricsResponse, 'avg(cache.item_size)' | 'cache_miss_rate()'>
  >;
  event: EventTransaction;
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
};

function GeneralInfo(props: GeneralInfoProps) {
  const {node, onParentClick} = props;

  const startTimestamp = node.space[0];
  const endTimestamp = node.space[0] + node.space[1];

  const durationInSeconds = (endTimestamp - startTimestamp) / 1e3;
  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(
      startTimestamp / 1e3,
      endTimestamp / 1e3
    );

  const parentTransaction = TraceTree.ParentTransaction(node);

  const items: SectionCardKeyValueList = [
    {
      key: 'duration',
      subject: t('Duration'),
      value: (
        <TraceDrawerComponents.Duration
          node={node}
          duration={durationInSeconds}
          baseline={undefined}
        />
      ),
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
    },
  ];

  if (parentTransaction) {
    items.push({
      key: 'parent_transaction',
      subject: t('Parent Transaction'),
      value: (
        <a onClick={() => onParentClick(parentTransaction)}>
          {getTraceTabTitle(parentTransaction)}
        </a>
      ),
    });
  }

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

export default GeneralInfo;
