import {useTheme} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';

import {markLine as createMarkLine} from 'sentry/components/charts/components/markLine';
import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

// The chart keeps this box whatever it draws, so that charts in a column line up.
// A number beside it centers on the same box.
export const VOLUME_CHART_HEIGHT = 36;
export const VOLUME_CHART_WIDTH = 160;

// Headroom above the tallest bar, which leaves room for the mark line and its
// label. The chart scales to the data it draws, so the same ratio on every chart
// puts every tallest bar at one height. The default axis instead rounds a maximum
// below ten up to ten, which makes a chart of five look shorter than one of five
// hundred.
const CHART_HEADROOM = 1.3;

// Plot area inside the chart box. `containLabel` would size it around the labels of
// the data it draws, which puts the bars of one chart at a different height from the
// next. Fixed insets hold the baseline at one height and keep the right edge clear
// for the mark line label.
const CHART_GRID = {top: 6, bottom: 6, left: 0, right: 25, containLabel: false};

type VolumeSeries = {
  name: string;
  // One value per interval.
  values: number[];
};

export function sumVolume(series: VolumeSeries[]): number {
  return series.reduce(
    (sum, {values}) => sum + values.reduce((seriesSum, value) => seriesSum + value, 0),
    0
  );
}

// The volume a filter drops over time as a sparkline of stacked bars, one stack
// layer per series.
// The largest series sits at the bottom, and a dashed line marks the tallest stack.
// Series without volume are left out, and a chart without any stays empty.
export function FilteredVolumeChart({
  intervals,
  series,
}: {
  // The start of each bar: a date string, or a timestamp in milliseconds.
  intervals: Array<string | number>;
  series: VolumeSeries[];
}) {
  const theme = useTheme();

  const layers = series
    .map(layer => ({...layer, total: sumVolume([layer])}))
    .filter(({total}) => total > 0)
    .sort((a, b) => b.total - a.total);
  const peak = Math.max(
    0,
    ...intervals.map((_, index) =>
      layers.reduce((sum, {values}) => sum + (values[index] ?? 0), 0)
    )
  );

  const markLine = createMarkLine({
    silent: true,
    animation: false,
    lineStyle: {
      color: theme.tokens.border.transparent.neutral.moderate,
      type: [4, 3], // Sets line type to "dashed" with 4 length and 3 gap
      opacity: 0.6,
      cap: 'round', // Rounded edges for the dashes
    },
    data: [{yAxis: peak}],
    label: {
      show: true,
      position: 'end',
      opacity: 1,
      color: theme.tokens.content.secondary,
      fontFamily: 'Rubik',
      fontSize: 10,
      formatter: formatAbbreviatedNumber(peak),
    },
  });

  return (
    <Container
      width={`${VOLUME_CHART_WIDTH}px`}
      height={`${VOLUME_CHART_HEIGHT}px`}
      role="img"
      aria-label={t('Filtered volume trend, peak %s', formatAbbreviatedNumber(peak))}
    >
      <MiniBarChart
        stacked
        animateBars
        showXAxisLine
        showMarkLineLabel
        hideZeros
        isGroupedByDate
        showTimeInTooltip
        height={VOLUME_CHART_HEIGHT}
        barOpacity={1}
        hideDelay={50}
        markLineLabelSide="right"
        grid={CHART_GRID}
        colors={theme.chart.getColorPalette(Math.max(layers.length, 1))}
        tooltip={{appendToBody: true}}
        yAxisMax={peak > 0 ? peak * CHART_HEADROOM : undefined}
        series={
          layers.length
            ? layers.map(({name, values}, index) => ({
                seriesName: name,
                markLine: index === 0 ? markLine : undefined,
                data: intervals.map((interval, i) => ({
                  name: interval,
                  value: values[i] ?? 0,
                })),
              }))
            : [
                {
                  seriesName: t('Filtered'),
                  data: intervals.map(interval => ({name: interval, value: 0})),
                },
              ]
        }
      />
    </Container>
  );
}
