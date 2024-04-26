import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import {
  isNotMarkMeasurement,
  isNotPerformanceScoreMeasurement,
  TraceEventCustomPerformanceMetric,
} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {useTraceAverageTransactionDuration} from '../../../../traceApi/useTraceAverageTransactionDuration';
import {TraceDrawerComponents} from '../../styles';

import {OpsBreakdown} from './opsBreakDown';

function WebVitals({event}: {event: EventTransaction}) {
  const measurementKeys = Object.keys(event?.measurements ?? {})
    .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
    .sort();

  if (!event || !event.measurements || measurementKeys.length <= 0) {
    return null;
  }

  return (
    <Fragment>
      {measurementKeys.map(measurement => (
        <TraceDrawerComponents.TableRow
          key={measurement}
          title={WEB_VITAL_DETAILS[`measurements.${measurement}`]?.name}
        >
          <PerformanceDuration
            milliseconds={Number(event.measurements?.[measurement].value.toFixed(3))}
            abbreviation
          />
        </TraceDrawerComponents.TableRow>
      ))}
    </Fragment>
  );
}

function CustomPerformanceMetrics({event, location, organization}) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .filter(isNotPerformanceScoreMeasurement)
    .sort();

  if (measurementNames.length <= 0) {
    return null;
  }

  return (
    <tr>
      <td className="key">{t('Measurements')}</td>
      <MeasurementsTd className="value">
        <Measurements>
          {measurementNames.map(name => {
            return (
              event && (
                <TraceEventCustomPerformanceMetric
                  key={name}
                  event={event}
                  name={name}
                  location={location}
                  organization={organization}
                  source={undefined}
                  isHomepage={false}
                />
              )
            );
          })}
        </Measurements>
      </MeasurementsTd>
    </tr>
  );
}

function DurationSummary({
  node,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
}) {
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

  return (
    <Fragment>
      <TraceDrawerComponents.TableRow title="Duration">
        <TraceDrawerComponents.Duration
          duration={durationInSeconds}
          baseline={avgDurationInSeconds}
          baseDescription={'Average duration for this transaction over the last 24 hours'}
        />
      </TraceDrawerComponents.TableRow>
      <TraceDrawerComponents.TableRow title="Date Range">
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
      </TraceDrawerComponents.TableRow>
    </Fragment>
  );
}

function EventSummary({
  node,
  onParentClick,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
}) {
  const parentTransaction = node.parent_transaction;

  return (
    <Fragment>
      {parentTransaction ? (
        <TraceDrawerComponents.TableRow title="Parent Transaction">
          <td className="value">
            <a onClick={() => onParentClick(parentTransaction)}>
              {getTraceTabTitle(parentTransaction)}
            </a>
          </td>
        </TraceDrawerComponents.TableRow>
      ) : null}
      <TraceDrawerComponents.TableRow title={t('Event ID')}>
        {node.value.event_id}
        <CopyToClipboardButton
          borderless
          size="zero"
          iconSize="xs"
          text={node.value.event_id}
        />
      </TraceDrawerComponents.TableRow>
      <TraceDrawerComponents.TableRow title={t('Description')}>
        <Link
          to={transactionSummaryRouteWithQuery({
            orgSlug: organization.slug,
            transaction: node.value.transaction,
            query: omit(location.query, Object.values(PAGE_URL_PARAM)),
            projectID: String(node.value.project_id),
          })}
        >
          {node.value.transaction}
        </Link>
      </TraceDrawerComponents.TableRow>
    </Fragment>
  );
}

type TableProps = {
  event: EventTransaction;
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
};

export function Table({node, onParentClick, organization, event, location}: TableProps) {
  return (
    <TraceDrawerComponents.Table className="table key-value">
      <tbody>
        <DurationSummary node={node} organization={organization} location={location} />
        <EventSummary
          node={node}
          onParentClick={onParentClick}
          organization={organization}
          location={location}
        />
        <OpsBreakdown event={event} />
        <WebVitals event={event} />
        <CustomPerformanceMetrics
          event={event}
          location={location}
          organization={organization}
        />
      </tbody>
    </TraceDrawerComponents.Table>
  );
}

const Measurements = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  padding-top: 10px;
`;

const MeasurementsTd = styled('td')`
  overflow: visible !important;
`;
