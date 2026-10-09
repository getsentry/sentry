import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CircleIndicator} from 'sentry/components/circleIndicator';
import {outcomeLabel, type OutcomeColors} from 'sentry/components/droppedData/outcomes';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

const STACK_NAME = 'dropped';

const CHART_HEIGHT = '112px';

export function droppedEventsToSeries(
  droppedEvents: DroppedEventsBucket[]
): Record<string, TimeSeries> {
  // Bars only stack when every series has a value at the same timestamps, so
  // build one shared, sorted time axis and zerofill each outcome onto it.
  const timestamps = [...new Set(droppedEvents.map(event => event.start))].sort(
    (a, b) => a - b
  );
  // Each event's (start, end) is its bucket, so its span is the interval.
  const interval = droppedEvents[0] ? droppedEvents[0].end - droppedEvents[0].start : 0;

  const countByOutcomeAndTimestamp = new Map<string, Map<number, number>>();
  for (const event of droppedEvents) {
    const countByTimestamp =
      countByOutcomeAndTimestamp.get(event.outcome) ?? new Map<number, number>();
    countByTimestamp.set(
      event.start,
      (countByTimestamp.get(event.start) ?? 0) + event.count
    );
    countByOutcomeAndTimestamp.set(event.outcome, countByTimestamp);
  }

  const seriesByOutcome: Record<string, TimeSeries> = {};
  for (const [outcome, countByTimestamp] of countByOutcomeAndTimestamp) {
    seriesByOutcome[outcome] = {
      yAxis: outcomeLabel(outcome),
      meta: {valueType: 'integer', valueUnit: null, interval},
      values: timestamps.map(timestamp => ({
        timestamp,
        value: countByTimestamp.get(timestamp) ?? 0,
      })),
    };
  }

  return seriesByOutcome;
}

function ChartLegend({colors, outcomes}: {colors: OutcomeColors; outcomes: string[]}) {
  return (
    <Flex align="center" gap="md">
      {outcomes.map(outcome => (
        <Flex key={outcome} align="center" gap="xs">
          <CircleIndicator color={colors[outcome]} size={8} />
          <Text size="xs">{outcomeLabel(outcome)}</Text>
        </Flex>
      ))}
    </Flex>
  );
}

interface DroppedDataChartProps {
  colors: OutcomeColors;
  droppedEvents: DroppedEventsBucket[];
}

export function DroppedDataChart({droppedEvents, colors}: DroppedDataChartProps) {
  const theme = useTheme();

  const {outcomes, plottables} = useMemo(() => {
    const series = droppedEventsToSeries(droppedEvents);
    const orderedOutcomes = Object.keys(series).sort();

    return {
      outcomes: orderedOutcomes,
      plottables: orderedOutcomes.map(
        outcome =>
          new Bars(series[outcome]!, {
            stack: STACK_NAME,
            color: colors[outcome],
            alias: outcomeLabel(outcome),
          })
      ),
    };
  }, [droppedEvents, colors]);

  const totalDropped = droppedEvents.reduce((sum, event) => sum + event.count, 0);

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
