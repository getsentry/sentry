import {useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import Chart from 'sentry/components/events/eventStatisticalDetector/lineChart';
import {DataSection} from 'sentry/components/events/styles';
import {Event} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {transformEventStats} from 'sentry/views/performance/trends/chart';
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

import {RELATIVE_DAYS_WINDOW} from './consts';

type EventFunctionBreakpointChartProps = {
  event: Event;
};

export function EventFunctionBreakpointChart({event}: EventFunctionBreakpointChartProps) {
  const evidenceData = event.occurrence?.evidenceData;
  const fingerprint = evidenceData?.fingerprint;
  const breakpoint = evidenceData?.breakpoint;

  const isValid = defined(fingerprint) && defined(breakpoint);

  useEffect(() => {
    if (isValid) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setContext('evidence data fields', {
        fingerprint,
        breakpoint,
      });

      Sentry.captureException(
        new Error('Missing required evidence data on function regression issue.')
      );
    });
  }, [isValid, fingerprint, breakpoint]);

  return (
    <EventFunctionBreakpointChartInner
      breakpoint={breakpoint}
      evidenceData={evidenceData!}
      fingerprint={fingerprint}
    />
  );
}

type EventFunctionBreakpointChartInnerProps = {
  breakpoint: number;
  evidenceData: Record<string, any>;
  fingerprint: number;
};

const SERIES = ['p95()'];

function EventFunctionBreakpointChartInner({
  breakpoint,
  evidenceData,
  fingerprint,
}: EventFunctionBreakpointChartInnerProps) {
  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });

  const functionStats = useProfileEventsStats({
    dataset: 'profileFunctions',
    datetime,
    query: `fingerprint:${fingerprint}`,
    referrer: 'api.profiling.functions.regression.stats',
    yAxes: SERIES,
  });

  const p95Series = useMemo(() => {
    const rawData = functionStats?.data?.data?.find(({axis}) => axis === 'p95()');
    const timestamps = functionStats?.data?.timestamps;
    if (!timestamps) {
      return [];
    }
    return transformEventStats(
      timestamps.map((timestamp, i) => [timestamp, [{count: rawData.values[i]}]]),
      'p95(function.duration)'
    );
  }, [functionStats]);

  const normalizedOccurrenceEvent = {
    aggregate_range_1: evidenceData.aggregateRange1 / 1e6,
    aggregate_range_2: evidenceData.aggregateRange2 / 1e6,
    breakpoint: evidenceData.breakpoint,
  } as NormalizedTrendsTransaction;

  return (
    <DataSection>
      <Chart
        percentileSeries={p95Series}
        evidenceData={normalizedOccurrenceEvent}
        datetime={datetime}
      />
    </DataSection>
  );
}
