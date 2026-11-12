import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {ChartType} from 'sentry/chartcuterie/types';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {type BreakpointEvidenceData} from './breakpointChartOptions';
import {RELATIVE_DAYS_WINDOW} from './consts';
import {getResolvedAt} from './getResolvedAt';
import {LineChart as Chart} from './lineChart';

type EventFunctionBreakpointChartProps = {
  event: Event;
  group: Group;
};

export function EventFunctionBreakpointChart({
  event,
  group,
}: EventFunctionBreakpointChartProps) {
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
      resolvedAt={getResolvedAt(group)}
    />
  );
}

type EventFunctionBreakpointChartInnerProps = {
  breakpoint: number;
  evidenceData: Record<string, any>;
  fingerprint: number;
  resolvedAt?: number;
};

const SERIES = ['p95()'];

function EventFunctionBreakpointChartInner({
  breakpoint,
  evidenceData,
  fingerprint,
  resolvedAt,
}: EventFunctionBreakpointChartInnerProps) {
  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });

  const {data: functionPercentileData} = useProfileEventsStats({
    dataset: 'profileFunctions',
    datetime,
    query: `fingerprint:${fingerprint}`,
    referrer: 'api.profiling.functions.regression.stats',
    yAxes: SERIES,
  });

  const normalizedOccurrenceEvent: BreakpointEvidenceData = {
    aggregate_range_1: evidenceData.aggregateRange1 / 1e6,
    aggregate_range_2: evidenceData.aggregateRange2 / 1e6,
    breakpoint: evidenceData.breakpoint,
  };

  return (
    <FoldSection
      sectionKey={SectionKey.REGRESSION_BREAKPOINT_CHART}
      title={t('Regression Breakpoint Chart')}
    >
      <Chart
        percentileData={functionPercentileData}
        evidenceData={normalizedOccurrenceEvent}
        datetime={datetime}
        resolvedAt={resolvedAt}
        chartType={ChartType.SLACK_PERFORMANCE_FUNCTION_REGRESSION}
      />
    </FoldSection>
  );
}
