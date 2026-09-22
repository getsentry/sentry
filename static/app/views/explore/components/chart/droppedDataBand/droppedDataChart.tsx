import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

export type DroppedDataCategory = string;

const STACK_NAME = 'dropped';

const CHART_HEIGHT = '112px';

function outcomeLabel(outcome: string): string {
  const words = outcome.split('_');
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    )
    .join(' ');
}

function orderCategories(categories: DroppedDataCategory[]): DroppedDataCategory[] {
  return [...categories].sort();
}

function getDroppedDataCategoryColors(
  categories: DroppedDataCategory[],
  theme: Theme
): Record<DroppedDataCategory, string> {
  const palette = theme.chart.getColorPalette(Math.max(categories.length - 1, 0));

  return categories.reduce<Record<DroppedDataCategory, string>>(
    (acc, category, index) => {
      acc[category] = palette[index % palette.length]!;
      return acc;
    },
    {}
  );
}

export function annotationsToSeries(
  annotations: Annotation[]
): Record<DroppedDataCategory, TimeSeries> {
  // Bars only stack when every series has a value at the same timestamps, so
  // build one shared, sorted time axis and zerofill each outcome onto it.
  const timestamps = [...new Set(annotations.map(annotation => annotation.start))].sort(
    (a, b) => a - b
  );
  // Buckets are uniformly spaced, so the first gap is the interval.
  const interval = timestamps.length > 1 ? timestamps[1]! - timestamps[0]! : 0;

  const countByOutcomeAndStart = new Map<string, Map<number, number>>();
  for (const annotation of annotations) {
    const label = outcomeLabel(annotation.outcome);
    const byStart = countByOutcomeAndStart.get(label) ?? new Map<number, number>();
    byStart.set(
      annotation.start,
      (byStart.get(annotation.start) ?? 0) + annotation.eventCount
    );
    countByOutcomeAndStart.set(label, byStart);
  }

  const byOutcome: Record<DroppedDataCategory, TimeSeries> = {};
  for (const [label, byStart] of countByOutcomeAndStart) {
    byOutcome[label] = {
      yAxis: label,
      meta: {valueType: 'integer', valueUnit: null, interval},
      values: timestamps.map(timestamp => ({
        timestamp,
        value: byStart.get(timestamp) ?? 0,
      })),
    };
  }

  return byOutcome;
}

function ChartLegend({
  categories,
  colors,
}: {
  categories: DroppedDataCategory[];
  colors: Record<DroppedDataCategory, string>;
}) {
  return (
    <Flex align="center" gap="md">
      {categories.map(category => (
        <Flex key={category} align="center" gap="xs">
          <Container
            width="8px"
            height="8px"
            radius="full"
            style={{backgroundColor: colors[category]}}
          />
          <Text size="xs">{category}</Text>
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

  const {categories, colors, plottables} = useMemo(() => {
    const series = annotationsToSeries(annotations);
    const orderedCategories = orderCategories(Object.keys(series));
    const categoryColors = getDroppedDataCategoryColors(orderedCategories, theme);

    return {
      categories: orderedCategories,
      colors: categoryColors,
      plottables: orderedCategories.map(
        category =>
          new Bars(series[category]!, {
            stack: STACK_NAME,
            color: categoryColors[category],
            alias: category,
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
          {t('%s dropped events', formatAbbreviatedNumber(totalDropped))}
        </Text>
        <ChartLegend categories={categories} colors={colors} />
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
