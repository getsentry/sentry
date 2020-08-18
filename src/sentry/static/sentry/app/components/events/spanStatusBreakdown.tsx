import React from 'react';
import styled from '@emotion/styled';

import {Event, SentryTransactionEvent} from 'app/types';
import {
  SpanEntry,
  RawSpanType,
  TraceContextType,
} from 'app/components/events/interfaces/spans/types';
import {SectionHeading} from 'app/components/charts/styles';
import {t} from 'app/locale';
import space from 'app/styles/space';

// Sentinel value indicating spans with no set span status
const noStatus = Symbol('spans-without-status');

type SpanStatusName = string | typeof noStatus;

const TOP_N_SPAN_STATUS = 4;

type SpanStatusTotals = Record<SpanStatusName, number>;

type SpanStatusStats = {name: string; percentage: number; total: number};

type SpanStatusBreakdownType = SpanStatusStats[];

type Props = {
  event: Event;
};

class SpanStatusBreakdown extends React.Component<Props> {
  getTransactionEvent(): SentryTransactionEvent | undefined {
    const {event} = this.props;

    if (event.type === 'transaction') {
      return event as SentryTransactionEvent;
    }

    return undefined;
  }

  generateBreakdown(): SpanStatusBreakdownType {
    const event = this.getTransactionEvent();

    if (!event) {
      return [];
    }

    const traceContext: TraceContextType | undefined = event?.contexts?.trace;

    if (!traceContext) {
      return [];
    }

    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    const spans: RawSpanType[] = spanEntry?.data ?? [];

    const rootSpanStatus = traceContext.status;
    const hasRootSpanStatus =
      typeof rootSpanStatus === 'string' && rootSpanStatus.length > 0;

    // add transaction root span
    spans.push({
      op: traceContext.op,
      timestamp: event.endTimestamp,
      start_timestamp: event.startTimestamp,
      trace_id: traceContext.trace_id || '',
      span_id: traceContext.span_id || '',
      status: hasRootSpanStatus ? rootSpanStatus : undefined,
      data: {},
    });

    // calculate total number of occurrences of span statuses

    const spanStatusTotals = spans.reduce(
      (totals: SpanStatusTotals, span: RawSpanType) => {
        let spanStatus: SpanStatusName | undefined = span.status;

        if (!spanStatus) {
          spanStatus = noStatus;
        }

        const total = totals[spanStatus] as number | undefined;

        if (typeof total !== 'number') {
          totals[spanStatus] = 1;
          return totals;
        }

        totals[spanStatus] = total + 1;
        return totals;
      },
      {} as SpanStatusTotals
    );

    const entries = Object.entries(spanStatusTotals);

    // Object.entries() will not return entries whose keys are Symbols.
    // We add them here if noStatus exists.
    if (noStatus in spanStatusTotals) {
      entries.push([t('no status'), spanStatusTotals[noStatus]]);
    }

    const sortedSpanStatusBreakdown = entries.sort(
      (first: [string, number], second: [string, number]) => {
        const firstTotal = first[1];
        const secondTotal = second[1];

        if (firstTotal === secondTotal) {
          return 0;
        }

        if (firstTotal < secondTotal) {
          // sort second before first
          return 1;
        }

        // otherwise, sort first before second
        return -1;
      }
    );

    // the total number of span statuses (including no status) is equvalent to the
    // number of spans
    const totalSum = spans.length;

    return sortedSpanStatusBreakdown.slice(0, TOP_N_SPAN_STATUS).map(
      ([spanStatus, total]: [string, number]): SpanStatusStats => {
        return {
          name: spanStatus,
          percentage: total / totalSum,
          total,
        };
      }
    );
  }

  render() {
    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }

    const breakdown = this.generateBreakdown();

    if (breakdown.length === 0) {
      return null;
    }

    return (
      <StyledBreakdown>
        <BreakdownHeader>
          <SectionHeading>{t('Span Status Breakdown')}</SectionHeading>
        </BreakdownHeader>
        <BreakdownGrid>
          {breakdown.map(currentSpanStatus => {
            const {name: spanStatusName, percentage} = currentSpanStatus;

            const percentageLabel = Number(percentage * 100).toFixed(1);

            return (
              <React.Fragment key={spanStatusName}>
                <Percentage>{percentageLabel}%</Percentage>
                <BarContainer>
                  <Bar
                    style={{
                      width: `${(percentage * 100).toFixed(3)}%`,
                    }}
                  />
                  <StatusName>{spanStatusName}</StatusName>
                </BarContainer>
              </React.Fragment>
            );
          })}
        </BreakdownGrid>
      </StyledBreakdown>
    );
  }
}

const StyledBreakdown = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const BreakdownHeader = styled('div')`
  display: flex;
  align-items: center;
`;

const BreakdownGrid = styled('div')`
  display: grid;
  grid-template-columns: min-content auto;
  column-gap: ${space(1)};
  row-gap: ${space(1)};
`;

const Percentage = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};

  text-align: right;
`;

const BarContainer = styled('div')`
  padding-left: ${space(1)};
  padding-right: ${space(1)};

  position: relative;
`;

const StatusName = styled('span')`
  position: relative;
  z-index: 2;

  font-size: ${p => p.theme.fontSizeSmall};
`;

const Bar = styled('div')`
  border-radius: 2px;
  background-color: ${p => p.theme.gray300};

  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;

  height: 100%;
  width: 0%;
`;

export default SpanStatusBreakdown;
