import {Fragment} from 'react';

import DateTime from 'sentry/components/dateTime';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import {t} from 'sentry/locale';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {TraceDrawerComponents} from '../../../../styles';

export function DurationSummary({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);
  const duration = endTimestamp - startTimestamp;
  const averageSpanSelfTime: number | undefined =
    span['span.averageResults']?.['avg(span.self_time)'];
  const averageSpanDuration: number | undefined =
    span['span.averageResults']?.['avg(span.duration)'];

  return (
    <Fragment>
      <TraceDrawerComponents.TableRow title={t('Duration')}>
        <TraceDrawerComponents.Duration
          duration={duration}
          baseline={averageSpanDuration ? averageSpanDuration / 1000 : undefined}
          baseDescription={t(
            'Average total time for this span group across the project associated with its parent transaction, over the last 24 hours'
          )}
        />
      </TraceDrawerComponents.TableRow>
      {span.exclusive_time ? (
        <TraceDrawerComponents.TableRow
          title={t('Self Time')}
          toolTipText={t(
            'The time spent exclusively in this span, excluding the total duration of its children'
          )}
        >
          <TraceDrawerComponents.Duration
            ratio={span.exclusive_time / 1000 / duration}
            duration={span.exclusive_time / 1000}
            baseline={averageSpanSelfTime ? averageSpanSelfTime / 1000 : undefined}
            baseDescription={t(
              'Average self time for this span group across the project associated with its parent transaction, over the last 24 hours'
            )}
          />
        </TraceDrawerComponents.TableRow>
      ) : null}
      <TraceDrawerComponents.TableRow title={t('Date Range')}>
        {getDynamicText({
          fixed: 'Mar 16, 2020 9:10:12 AM UTC',
          value: (
            <Fragment>
              <DateTime date={startTimestamp * 1000} year seconds timeZone />
              {` (${startTimeWithLeadingZero})`}
            </Fragment>
          ),
        })}
        <br />
        {getDynamicText({
          fixed: 'Mar 16, 2020 9:10:13 AM UTC',
          value: (
            <Fragment>
              <DateTime date={endTimestamp * 1000} year seconds timeZone />
              {` (${endTimeWithLeadingZero})`}
            </Fragment>
          ),
        })}
      </TraceDrawerComponents.TableRow>
    </Fragment>
  );
}
