import {useTheme} from '@emotion/react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {CategoricalSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization';
import {Bars as CategoricalBars} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/bars';
import type {
  CategoricalSeries,
  TimeSeries,
} from 'sentry/views/dashboards/widgets/common/types';
import {createPlottableFromTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import type {ChartUnit} from './chartTypes';

type TimeSeriesVisualization = 'line' | 'area' | 'bar';

const UNIT_METADATA = {
  number: {valueType: 'number', valueUnit: null},
  percentage: {valueType: 'percentage', valueUnit: null},
  duration: {valueType: 'duration', valueUnit: DurationUnit.MILLISECOND},
  bytes: {valueType: 'size', valueUnit: SizeUnit.BYTE},
} satisfies Record<ChartUnit, Pick<TimeSeries['meta'], 'valueType' | 'valueUnit'>>;

const DISPLAY_TYPES = {
  line: DisplayType.LINE,
  area: DisplayType.AREA,
  bar: DisplayType.BAR,
} satisfies Record<TimeSeriesVisualization, DisplayType>;

/** Height of the plotting area itself, in px, before any legend. */
const CHART_HEIGHT = 220;

/**
 * Height of the box the visualization renders into.
 *
 * Both visualizations lay an interactive legend out *inside* that box, as a row
 * above the plot, as soon as there is more than one series. The ECharts canvas
 * is sized in pixels and doesn't give that row its space back, so a height
 * fixed at the plot's leaves the chart spilling out the bottom of the box and
 * over whatever follows it. Give the legend its own height instead of letting
 * it eat into the plot's.
 */
export function getChartContentHeight(seriesCount: number, legendHeight: number) {
  return seriesCount > 1 ? CHART_HEIGHT + legendHeight : CHART_HEIGHT;
}

function getInterval(timestamps: number[]): number {
  const intervals = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - timestamps[index]!)
    .filter(interval => interval > 0);
  return intervals.length > 0 ? Math.min(...intervals) : 0;
}

function normalizeValue(value: number, unit: ChartUnit): number {
  return unit === 'percentage' ? value / 100 : value;
}

function getSeriesLabel(series: {label: string} | {name: string}): string {
  return 'label' in series ? series.label : series.name;
}

export function ChartContent({
  data: {title, subtitle, visualization, x_axis: xAxis, y_axis_unit: yAxisUnit, series},
  showHeader = true,
}: {
  data: EmbedOutput<'chart'>;
  showHeader?: boolean;
}) {
  const theme = useTheme();
  const metadata = UNIT_METADATA[yAxisUnit];

  // `ChartLegend` pins its row to `form.xs.height`.
  const height = getChartContentHeight(series.length, parseInt(theme.form.xs.height, 10));

  const visualizationComponent =
    xAxis === 'category' ? (
      <CategoricalSeriesWidgetVisualization
        plottables={series.map((item, index) => {
          const categoricalSeries: CategoricalSeries = {
            valueAxis: `seer-chart-series-${index}`,
            meta: metadata,
            values: item.data.map(point => ({
              category: point.x,
              value: normalizeValue(point.y, yAxisUnit),
            })),
          };
          return new CategoricalBars(categoricalSeries, {
            alias: getSeriesLabel(item),
          });
        })}
      />
    ) : (
      <TimeSeriesWidgetVisualization
        onZoom={() => {}}
        pageFilters={{
          datetime: {
            start: new Date(
              Math.min(
                ...series.flatMap(item =>
                  item.data.map(point => Date.parse(String(point.x)))
                )
              )
            ).toISOString(),
            end: new Date(
              Math.max(
                ...series.flatMap(item =>
                  item.data.map(point => Date.parse(String(point.x)))
                )
              )
            ).toISOString(),
            period: null,
            utc: true,
          },
          environments: [],
          projects: [],
        }}
        plottables={series
          .map((item, index) => {
            const values = item.data
              .map(point => ({
                timestamp: Date.parse(String(point.x)),
                value: normalizeValue(point.y, yAxisUnit),
              }))
              .toSorted((left, right) => left.timestamp - right.timestamp);
            const timeSeries: TimeSeries = {
              yAxis: `seer-chart-series-${index}`,
              meta: {
                ...metadata,
                interval: getInterval(values.map(point => point.timestamp)),
              },
              values,
            };
            return createPlottableFromTimeSeries(
              DISPLAY_TYPES[visualization],
              timeSeries,
              {
                alias: getSeriesLabel(item),
                name: `seer-chart-series-${index}`,
              }
            );
          })
          .filter((plottable): plottable is Plottable => plottable !== null)}
        showReleaseAs="none"
      />
    );

  return (
    <Stack gap="0" width="100%">
      {showHeader ? (
        <Stack gap="2xs" paddingBottom="sm">
          <Heading as="h3" size="md">
            {title}
          </Heading>
          {subtitle ? (
            <Text size="sm" variant="muted">
              {subtitle}
            </Text>
          ) : null}
        </Stack>
      ) : null}
      {/*
        ECharts sizes its canvas to an explicit pixel width, which would
        otherwise propagate up as this box's min-content width and stop every
        ancestor from shrinking below whatever the chart last measured — in a
        centering flex row (Storybook's `Demo`) that widens the whole embed and
        spills it out both sides. `min-width: 0` plus a non-visible `overflow`
        cuts the canvas out of that min-content chain, and clips a stale canvas
        instead of letting it paint outside. Tooltips are unaffected; both
        visualizations render them with `appendToBody`.
      */}
      <Container
        data-test-id="seer-chart-content"
        height={`${height}px`}
        minWidth="0"
        overflow="hidden"
        width="100%"
      >
        {visualizationComponent}
      </Container>
    </Stack>
  );
}

export const Chart = defineSeerEmbed({
  name: 'chart',
  render(data) {
    return (
      <Container
        as="section"
        background="primary"
        border="primary"
        data-test-id="seer-chart-embed"
        margin="lg 0"
        // Same guarantee as every other chart-bearing embed: the canvas doesn't
        // get to widen the conversation around it. See `getChartContentHeight`.
        minWidth="0"
        overflow="hidden"
        padding="lg xl md"
        radius="md"
      >
        <ChartContent data={data} />
      </Container>
    );
  },
});
