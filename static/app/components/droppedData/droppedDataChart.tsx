import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {Outcome} from 'sentry/types/core';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

const STACK_NAME = 'dropped';

const CHART_HEIGHT = '112px';

const OUTCOME_LABELS: Partial<Record<Outcome, string>> = {
  [Outcome.CLIENT_DISCARD]: t('Client discard'),
  [Outcome.FILTERED]: t('Inbound filter'),
  [Outcome.INVALID]: t('Invalid or malformed'),
  [Outcome.RATE_LIMITED]: t('Rate limited'),
  [Outcome.ABUSE]: t('Abuse limit'),
  [Outcome.CARDINALITY_LIMITED]: t('Cardinality limit'),
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome as Outcome] ?? outcome;
}

function orderOutcomes(outcomes: string[]): string[] {
  return [...outcomes].sort();
}

export function getOutcomeColors(
  outcomes: string[],
  theme: Theme
): Record<string, string> {
  const palette = theme.chart.getColorPalette(Math.max(outcomes.length - 1, 0));

  return outcomes.reduce<Record<string, string>>((acc, outcome, index) => {
    acc[outcome] = palette[index % palette.length]!;
    return acc;
  }, {});
}

export function annotationsToSeries(
  annotations: Annotation[]
): Record<string, TimeSeries> {
  // Bars only stack when every series has a value at the same timestamps, so
  // build one shared, sorted time axis and zerofill each outcome onto it.
  const timestamps = [...new Set(annotations.map(annotation => annotation.start))].sort(
    (a, b) => a - b
  );
  // Each annotation's (start, end) is its bucket, so its span is the interval.
  const interval = annotations[0] ? annotations[0].end - annotations[0].start : 0;

  const eventCountByLabelAndTimestamp = new Map<string, Map<number, number>>();
  for (const annotation of annotations) {
    const label = outcomeLabel(annotation.outcome);
    const eventCountByTimestamp =
      eventCountByLabelAndTimestamp.get(label) ?? new Map<number, number>();
    eventCountByTimestamp.set(
      annotation.start,
      (eventCountByTimestamp.get(annotation.start) ?? 0) + annotation.eventCount
    );
    eventCountByLabelAndTimestamp.set(label, eventCountByTimestamp);
  }

  const seriesByLabel: Record<string, TimeSeries> = {};
  for (const [label, eventCountByTimestamp] of eventCountByLabelAndTimestamp) {
    seriesByLabel[label] = {
      yAxis: label,
      meta: {valueType: 'integer', valueUnit: null, interval},
      values: timestamps.map(timestamp => ({
        timestamp,
        value: eventCountByTimestamp.get(timestamp) ?? 0,
      })),
    };
  }

  return seriesByLabel;
}

function ChartLegend({
  outcomes,
  colors,
}: {
  colors: Record<string, string>;
  outcomes: string[];
}) {
  return (
    <Flex align="center" gap="md">
      {outcomes.map(outcome => (
        <Flex key={outcome} align="center" gap="xs">
          <Container
            width="8px"
            height="8px"
            radius="full"
            style={{backgroundColor: colors[outcome]}}
          />
          <Text size="xs">{outcome}</Text>
        </Flex>
      ))}
    </Flex>
  );
}

interface DroppedDataChartProps {
  annotations: Annotation[];
}

export function DroppedDataChart({annotations}: DroppedDataChartProps) {
  const theme = useTheme();

  const {outcomes, colors, plottables} = useMemo(() => {
    const series = annotationsToSeries(annotations);
    const orderedOutcomes = orderOutcomes(Object.keys(series));
    const outcomeColors = getOutcomeColors(orderedOutcomes, theme);

    return {
      outcomes: orderedOutcomes,
      colors: outcomeColors,
      plottables: orderedOutcomes.map(
        outcome =>
          new Bars(series[outcome]!, {
            stack: STACK_NAME,
            color: outcomeColors[outcome],
            alias: outcome,
          })
      ),
    };
  }, [annotations, theme]);

  const totalDropped = annotations.reduce(
    (sum, annotation) => sum + annotation.eventCount,
    0
  );

  return (
    <Container
      border="primary"
      radius="lg"
      padding="md xl xl xl"
      style={{borderColor: theme.tokens.graphics.neutral.moderate}}
    >
      <Flex align="center" justify="between" paddingBottom="md">
        <Text size="lg" bold>
          {t('%s Dropped Events', formatAbbreviatedNumber(totalDropped))}
        </Text>
        <ChartLegend outcomes={outcomes} colors={colors} />
      </Flex>
      <Container height={CHART_HEIGHT}>
        {plottables.length > 0 ? (
          <TimeSeriesWidgetVisualization plottables={plottables} showLegend="never" />
        ) : (
          <TimeSeriesWidgetVisualization.NoData />
        )}
      </Container>
    </Container>
  );
}
