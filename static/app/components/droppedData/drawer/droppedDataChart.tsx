import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ChartLegend, type LegendItem} from 'sentry/components/charts/chartLegend';
import {
  isOutcomeSelected,
  outcomeLabel,
  type OutcomeColors,
  type OutcomeSelection,
} from 'sentry/components/droppedData/outcomes';
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

interface DroppedDataChartProps {
  colors: OutcomeColors;
  droppedEvents: DroppedEventsBucket[];
  onSelectionChange: (selection: OutcomeSelection) => void;
  selection: OutcomeSelection;
}

export function DroppedDataChart({
  droppedEvents,
  colors,
  selection,
  onSelectionChange,
}: DroppedDataChartProps) {
  const theme = useTheme();

  const {legendItems, plottables} = useMemo(() => {
    const series = droppedEventsToSeries(droppedEvents);
    const orderedOutcomes = Object.keys(series).sort();

    return {
      legendItems: orderedOutcomes.map((outcome): LegendItem => ({
        name: outcome,
        label: outcomeLabel(outcome),
        color: colors[outcome]!,
      })),
      plottables: orderedOutcomes
        .filter(outcome => isOutcomeSelected(selection, outcome))
        .map(
          outcome =>
            new Bars(series[outcome]!, {
              stack: STACK_NAME,
              color: colors[outcome],
              alias: outcomeLabel(outcome),
            })
        ),
    };
  }, [droppedEvents, colors, selection]);

  const totalDropped = droppedEvents
    .filter(event => isOutcomeSelected(selection, event.outcome))
    .reduce((sum, event) => sum + event.count, 0);

  return (
    <Container
      border="primary"
      radius="lg"
      padding="md xl xl xl"
      style={{borderColor: theme.tokens.graphics.neutral.moderate}}
    >
      <Flex align="center" gap="xl" paddingBottom="md">
        <Text size="lg" bold wrap="nowrap">
          {t('%s Dropped Events', formatAbbreviatedNumber(totalDropped))}
        </Text>
        <Container flex="1" minWidth="0">
          <ChartLegend
            items={legendItems}
            selected={selection}
            onSelectionChange={onSelectionChange}
          />
        </Container>
      </Flex>
      <Container height={CHART_HEIGHT}>
        {plottables.length > 0 ? (
          <TimeSeriesWidgetVisualization plottables={plottables} showLegend="never" />
        ) : legendItems.length > 0 ? (
          <Flex height="100%" align="center">
            <EmptyState
              title={t('No outcomes selected.')}
              description={t(
                'Select an outcome in the legend to see its dropped events.'
              )}
            />
          </Flex>
        ) : (
          <TimeSeriesWidgetVisualization.NoData />
        )}
      </Container>
    </Container>
  );
}
