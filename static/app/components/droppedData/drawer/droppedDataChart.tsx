import {useMemo} from 'react';

import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ChartLegend, type LegendItem} from 'sentry/components/charts/chartLegend';
import {
  isOutcomeSelected,
  type OutcomeColors,
  type OutcomeSelection,
} from 'sentry/components/droppedData/drawer/outcomeColors';
import {datasetNoun, outcomeLabel} from 'sentry/components/droppedData/outcomes';
import type {OutcomeRow} from 'sentry/components/droppedData/types';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

const STACK_NAME = 'dropped';

const CHART_HEIGHT = '112px';

export function droppedEventsToSeries(
  droppedEvents: OutcomeRow[]
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
  dataset: DiscoverDatasets;
  droppedEvents: OutcomeRow[];
  hasAskSeer: boolean;
  onSelectionChange: (selection: OutcomeSelection) => void;
  selection: OutcomeSelection;
}

export function DroppedDataChart({
  droppedEvents,
  colors,
  dataset,
  hasAskSeer,
  selection,
  onSelectionChange,
}: DroppedDataChartProps) {
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
    <Stack gap="md">
      <Stack gap="sm">
        <Heading as="h2" size="lg">
          {t(
            '%s dropped and filtered %s',
            formatAbbreviatedNumber(totalDropped),
            datasetNoun(dataset, totalDropped)
          )}
        </Heading>
        <Text size="sm">
          {hasAskSeer
            ? t(
                'Your filtered events are broken down by category below. Use Seer to understand what each category means and how to fix common causes of unintentional data loss.'
              )
            : t(
                'Your filtered events are broken down by category below. Each reason links to docs with explanations and common fixes of unintentional data loss.'
              )}
        </Text>
      </Stack>
      <ChartLegend
        items={legendItems}
        selected={selection}
        onSelectionChange={onSelectionChange}
      />
      <Container height={CHART_HEIGHT}>
        {plottables.length > 0 ? (
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            showLegend="never"
            disableZoom
          />
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
    </Stack>
  );
}
