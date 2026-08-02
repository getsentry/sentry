import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
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

export const Chart = defineSeerEmbed({
  name: 'chart',
  render({
    title,
    subtitle,
    visualization,
    x_axis: xAxis,
    y_axis_unit: yAxisUnit,
    series,
  }) {
    const metadata = UNIT_METADATA[yAxisUnit];

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
      <Container
        as="section"
        background="primary"
        border="primary"
        data-test-id="seer-chart-embed"
        margin="lg 0"
        padding="lg xl md"
        radius="md"
      >
        <Stack gap="2xs" paddingBottom="sm">
          <Heading as="h3" size="md">
            {title}
          </Heading>
          {subtitle && (
            <Text size="sm" variant="muted">
              {subtitle}
            </Text>
          )}
        </Stack>
        <Container height="220px">{visualizationComponent}</Container>
      </Container>
    );
  },
});
