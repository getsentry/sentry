import {Fragment, useMemo} from 'react';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import {generateStats} from 'sentry/components/events/opsBreakdown';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useTraceAverageTransactionDuration} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceAverageTransactionDuration';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

import {OpsBreakdown} from './opsBreakDown';

type GeneralInfoProps = {
  event: EventTransaction;
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
};

function GeneralInfo({
  node,
  location,
  organization,
  onParentClick,
  event,
}: GeneralInfoProps) {
  const {data: averageDurationQueryResult} = useTraceAverageTransactionDuration({
    node,
    location,
    organization,
  });

  const avgDurationInSeconds: number = useMemo(() => {
    return (
      Number(averageDurationQueryResult?.data?.[0]?.['avg(transaction.duration)']) / 1000
    );
  }, [averageDurationQueryResult]);

  const startTimestamp = Math.min(node.value.start_timestamp, node.value.timestamp);
  const endTimestamp = Math.max(node.value.start_timestamp, node.value.timestamp);
  const durationInSeconds = endTimestamp - startTimestamp;

  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);

  const parentTransaction = node.parent_transaction;

  const items: SectionCardKeyValueList = [
    {
      key: 'duration',
      subject: t('Duration'),
      value: (
        <TraceDrawerComponents.Duration
          duration={durationInSeconds}
          baseline={avgDurationInSeconds}
          baseDescription={'Average duration for this transaction over the last 24 hours'}
        />
      ),
    },
  ];

  items.push({
    key: 'date_range',
    subject: t('Date Range'),
    value: (
      <Fragment>
        {getDynamicText({
          fixed: 'Mar 19, 2021 11:06:27 AM UTC',
          value: (
            <Fragment>
              <DateTime date={startTimestamp * node.multiplier} />
              {` (${startTimeWithLeadingZero})`}
            </Fragment>
          ),
        })}
        <br />
        {getDynamicText({
          fixed: 'Mar 19, 2021 11:06:28 AM UTC',
          value: (
            <Fragment>
              <DateTime date={endTimestamp * node.multiplier} />
              {` (${endTimeWithLeadingZero})`}
            </Fragment>
          ),
        })}
      </Fragment>
    ),
  });

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

  items.push({
    key: 'event_id',
    subject: t('Event ID'),
    value: (
      <Fragment>
        {node.value.event_id}
        <CopyToClipboardButton
          borderless
          size="zero"
          iconSize="xs"
          text={node.value.event_id}
        />
      </Fragment>
    ),
  });

  items.push({
    key: 'description',
    subject: t('Description'),
    value: (
      <TraceDrawerComponents.CopyableCardValueWithLink
        value={node.value.transaction}
        linkTarget={transactionSummaryRouteWithQuery({
          orgSlug: organization.slug,
          transaction: node.value.transaction,
          // Omit the query from the target url, as we dont know where it may have came from
          // and if its syntax is supported on the target page. In this example, txn search does
          // not support is:filter type expressions (and possibly other expressions we dont know about)
          query: omit(location.query, Object.values(PAGE_URL_PARAM).concat('query')),
          projectID: String(node.value.project_id),
        })}
        linkText={t('View transaction summary')}
      />
    ),
  });

  const breakdown = generateStats(event, {type: 'no_filter'});

  if (breakdown.length > 0) {
    items.push({
      key: 'ops_breakdown',
      subject: t('Ops Breakdown'),
      subjectNode: (
        <TraceDrawerComponents.FlexBox style={{gap: '5px'}}>
          {t('Ops Breakdown')}
          <QuestionTooltip
            title={t('Applicable to the children of this event only')}
            size="xs"
          />
        </TraceDrawerComponents.FlexBox>
      ),
      value: <OpsBreakdown breakdown={breakdown} />,
    });
  }

  return (
    <TraceDrawerComponents.SectionCard
      items={items}
      title={t('General')}
      disableTruncate
    />
  );
}

export default GeneralInfo;
