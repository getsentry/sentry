import {Fragment} from 'react';
import {useTheme, type Theme} from '@emotion/react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {escape} from 'sentry/utils';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {CategoricalSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization';
import {Bars as CategoricalBars} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/bars';
import type {
  CategoricalSeries,
  TimeSeries,
} from 'sentry/views/dashboards/widgets/common/types';
import {formatTooltipValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue';
import {createPlottableFromTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {describeChartPointProvenance, isDerivedChartPoint} from './chartProvenance';
import {TransformedLine} from './chartTransformedLine';
import type {ChartUnit} from './chartTypes';
import {SeerEmbedBlock} from './seerEmbedBlock';

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

// The agent often copies offset-less times out of Sentry URLs, which Sentry reads
// as UTC. `Date.parse` would read them as the viewer's local time instead.
function parseTimestamp(x: string | number): number {
  const value = String(x);
  return Date.parse(/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(value) ? value : `${value}Z`);
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

/**
 * A smoothed series carries no observed value at all, so its legend entry says
 * so rather than reading as the raw measurement.
 */
function getSeriesAlias(series: EmbedOutput<'chart'>['series'][number]): string {
  const label = getSeriesLabel(series);
  const valued = series.data.filter(point => point.y !== null);
  return valued.length > 0 && valued.every(point => point.smoothed)
    ? t('%s (smoothed)', label)
    : label;
}

/**
 * Only a time-axis line can mark derived values (as dashes) and gaps (as
 * breaks) in the plot itself. Bars have no dashed form, a missing bar looks like
 * a zero one, and an area stacks a derived run onto the observed values below
 * it, so those charts list their points instead.
 */
function shouldRenderTable({
  series,
  visualization,
  x_axis: xAxis,
}: EmbedOutput<'chart'>): boolean {
  const points = series.flatMap(item => item.data);
  if (points.every(point => point.y === null)) {
    return true;
  }
  if (xAxis === 'category') {
    return points.some(point => point.y === null || isDerivedChartPoint(point));
  }
  return visualization !== 'line' && points.some(isDerivedChartPoint);
}

/**
 * Lists every point when the chart cannot draw it faithfully. Each cell says
 * whether its value was observed, filled, smoothed, or reported as missing; a
 * series with no point at a row's x at all shows a dash.
 */
function ChartTable({
  data: {series, x_axis: xAxis, y_axis_unit: yAxisUnit},
}: {
  data: EmbedOutput<'chart'>;
}) {
  const getKey = (x: string | number) =>
    xAxis === 'time' ? parseTimestamp(x) : String(x);
  const rowKeys = [
    ...new Set(series.flatMap(item => item.data.map(point => getKey(point.x)))),
  ];
  if (xAxis === 'time') {
    rowKeys.sort((left, right) => Number(left) - Number(right));
  }
  const showSeconds = rowKeys.some(key => typeof key === 'number' && key % 60_000 !== 0);
  const showMilliseconds = rowKeys.some(
    key => typeof key === 'number' && key % 1000 !== 0
  );
  const pointsBySeries = series.map(
    item => new Map(item.data.map(point => [getKey(point.x), point]))
  );
  const {valueType, valueUnit} = UNIT_METADATA[yAxisUnit];

  return (
    <SimpleTable
      columns={[
        {key: 'x', width: 'minmax(0, 1fr)'},
        ...series.map((_, index) => ({key: `series-${index}`, width: 'minmax(0, 1fr)'})),
      ]}
      data-test-id="seer-chart-table"
      density="compressed"
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>
            {xAxis === 'time' ? t('Time') : t('Category')}
          </SimpleTable.HeaderCell>
          {series.map((item, index) => (
            <SimpleTable.HeaderCell key={index}>
              {getSeriesLabel(item)}
            </SimpleTable.HeaderCell>
          ))}
        </SimpleTable.HeaderRow>
      }
      maxHeight="320px"
    >
      {rowKeys.map(rowKey => (
        <SimpleTable.Row key={rowKey}>
          <SimpleTable.RowCell>
            {typeof rowKey === 'number' ? (
              <DateTime
                date={rowKey}
                seconds={showSeconds}
                milliseconds={showMilliseconds}
              />
            ) : (
              rowKey
            )}
          </SimpleTable.RowCell>
          {pointsBySeries.map((points, index) => {
            const point = points.get(rowKey);
            const provenance = point ? describeChartPointProvenance(point) : null;

            return (
              <SimpleTable.RowCell key={index}>
                {point === undefined ? (
                  '—'
                ) : point.y === null ? (
                  <Text variant="muted">{t('No data')}</Text>
                ) : (
                  <Text>
                    {formatTooltipValue(
                      normalizeValue(point.y, yAxisUnit),
                      valueType,
                      valueUnit ?? undefined
                    )}
                    {provenance ? (
                      <Fragment>
                        {' '}
                        <Text variant="muted">({provenance})</Text>
                      </Fragment>
                    ) : null}
                  </Text>
                )}
              </SimpleTable.RowCell>
            );
          })}
        </SimpleTable.Row>
      ))}
    </SimpleTable>
  );
}

/**
 * Says, under the values in a tooltip, which of them a transformation filled in
 * or smoothed. Series are keyed by the ECharts name each plottable is given.
 */
function getProvenanceTooltipDetails(
  series: EmbedOutput<'chart'>['series'],
  theme: Theme
): (seriesNames: string[], timestamp: number) => string {
  const provenanceBySeries = new Map(
    series.map((item, index) => [
      `seer-chart-series-${index}`,
      {
        label: getSeriesAlias(item),
        byTimestamp: new Map(
          item.data.flatMap(point => {
            const provenance = describeChartPointProvenance(point);
            return provenance ? [[parseTimestamp(point.x), provenance] as const] : [];
          })
        ),
      },
    ])
  );
  const style = [
    `border-top: solid 1px ${theme.tokens.border.secondary}`,
    `margin: ${theme.space.md} calc(-1 * ${theme.space.xl}) 0`,
    `padding: ${theme.space.md} ${theme.space.xl} 0`,
    `color: ${theme.tokens.content.secondary}`,
  ].join('; ');

  return (seriesNames, timestamp) => {
    const lines = seriesNames.flatMap(name => {
      const entry = provenanceBySeries.get(name);
      const provenance = entry?.byTimestamp.get(timestamp);
      return entry && provenance
        ? [`<div>${escape(t('%s: %s value', entry.label, provenance))}</div>`]
        : [];
    });
    return lines.length > 0 ? `<div style="${style}">${lines.join('')}</div>` : '';
  };
}

export function ChartContent({
  data,
  showHeader = true,
}: {
  data: EmbedOutput<'chart'>;
  showHeader?: boolean;
}) {
  const {
    title,
    subtitle,
    visualization,
    x_axis: xAxis,
    y_axis_unit: yAxisUnit,
    series,
  } = data;
  const theme = useTheme();
  const metadata = UNIT_METADATA[yAxisUnit];
  const renderTable = shouldRenderTable(data);
  const hasDerivedPoints = series.some(item => item.data.some(isDerivedChartPoint));

  const renderTooltipSeriesDetails = hasDerivedPoints
    ? getProvenanceTooltipDetails(series, theme)
    : undefined;
  // The categorical visualization only draws bars, so a category line or area
  // chart falls back to bars rather than dropping the agent's data.
  const visualizationComponent =
    xAxis === 'category' ? (
      <CategoricalSeriesWidgetVisualization
        plottables={series.map((item, index) => {
          const categoricalSeries: CategoricalSeries = {
            valueAxis: `seer-chart-series-${index}`,
            meta: metadata,
            values: item.data.map(point => ({
              category: point.x,
              value: point.y === null ? null : normalizeValue(point.y, yAxisUnit),
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
                ...series.flatMap(item => item.data.map(point => parseTimestamp(point.x)))
              )
            ).toISOString(),
            end: new Date(
              Math.max(
                ...series.flatMap(item => item.data.map(point => parseTimestamp(point.x)))
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
            const points = item.data
              .map(point => ({point, timestamp: parseTimestamp(point.x)}))
              .toSorted((left, right) => left.timestamp - right.timestamp);
            const values = points.map(({point, timestamp}) => ({
              timestamp,
              value: point.y === null ? null : normalizeValue(point.y, yAxisUnit),
            }));
            const timeSeries: TimeSeries = {
              yAxis: `seer-chart-series-${index}`,
              meta: {
                ...metadata,
                interval: getInterval(values.map(point => point.timestamp)),
              },
              values,
            };
            const config = {
              alias: getSeriesAlias(item),
              name: `seer-chart-series-${index}`,
            };
            const derivedTimestamps = new Set(
              points
                .filter(({point}) => isDerivedChartPoint(point))
                .map(({timestamp}) => timestamp)
            );
            return derivedTimestamps.size > 0 ||
              (visualization === 'line' && values.some(point => point.value === null))
              ? new TransformedLine(timeSeries, derivedTimestamps, config)
              : createPlottableFromTimeSeries(
                  DISPLAY_TYPES[visualization],
                  timeSeries,
                  config
                );
          })
          .filter((plottable): plottable is Plottable => plottable !== null)}
        renderTooltipSeriesDetails={renderTooltipSeriesDetails}
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
      {renderTable ? (
        <Stack gap="sm" data-test-id="seer-chart-content" width="100%">
          <Text size="sm" variant="muted">
            {t(
              'Shown as a table so missing, filled, and smoothed values are not mistaken for observed ones.'
            )}
          </Text>
          <ChartTable data={data} />
        </Stack>
      ) : (
        <Stack gap="sm" width="100%">
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
          {hasDerivedPoints ? (
            <Text size="sm" variant="muted">
              {t(
                'Dashed lines are values a transformation filled in or smoothed, not observed measurements.'
              )}
            </Text>
          ) : null}
        </Stack>
      )}
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
