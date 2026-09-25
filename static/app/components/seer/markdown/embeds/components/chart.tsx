import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
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

/**
 * Ensures an ISO 8601 timestamp string is interpreted as UTC by `Date.parse`.
 * The AI model frequently omits the timezone offset (e.g. `2026-09-25T13:00:00`
 * instead of `2026-09-25T13:00:00Z`). Without a suffix, `Date.parse` treats the
 * string as local time on most runtimes, shifting the chart by the viewer's UTC
 * offset. Appending `Z` forces UTC interpretation.
 */
function normalizeTimestamp(x: string | number): number {
  if (typeof x === 'string' && !x.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(x)) {
    return Date.parse(`${x}Z`);
  }
  return Date.parse(String(x));
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
                  item.data.map(point => normalizeTimestamp(point.x))
                )
              )
            ).toISOString(),
            end: new Date(
              Math.max(
                ...series.flatMap(item =>
                  item.data.map(point => normalizeTimestamp(point.x))
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
                timestamp: normalizeTimestamp(point.x),
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
        // An embed's chart is as wide as the card it sits in, which is narrow
        // and clips. Left to size itself to a model-written series name, the
        // legend's "+n more" menu grows past the card and is cut off.
        truncateLegendMenuLabels
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
        Inline-size containment: without it a wide legend sets this box's
        min-content width, which no ancestor can shrink below, and the chart
        overflows its container. Containment computes the width as if the box
        were empty, so the legend measures against the container instead of
        dictating it.
      */}
      <Container
        containerType="inline-size"
        data-test-id="seer-chart-content"
        height="220px"
        width="100%"
      >
        {visualizationComponent}
      </Container>
    </Stack>
  );
}

export const Chart = defineSeerEmbed({
  name: 'chart',
  render(data, level) {
    switch (level) {
      case 'markdown':
        // A plot has no text form; the heading names the data being cited.
        return data.subtitle ? `${data.title}: ${data.subtitle}` : data.title;
      case 'block':
      case 'inline':
        return (
          // No link out: the chart is drawn from data in the answer, so there
          // is no page in Sentry showing the same thing. The card's header band
          // takes the chart's title -- it has no second line for the subtitle,
          // which moves into the panel above the plot.
          // Left expanded, the card's default: a chart is the point of the
          // sentence that introduces it.
          <SeerEmbedBlock gap="sm" testId="seer-chart-embed" title={data.title}>
            {data.subtitle ? (
              <Text size="sm" variant="muted">
                {data.subtitle}
              </Text>
            ) : null}
            <ChartContent data={data} showHeader={false} />
          </SeerEmbedBlock>
        );
    }
  },
});
