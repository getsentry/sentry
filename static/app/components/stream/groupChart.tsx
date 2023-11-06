import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import {Group, TimeseriesValue} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';

import {FastMiniBarChart} from '../charts/fastMiniBarChart';

function asChartPoint(point: [number, number]): {name: number | string; value: number} {
  return {
    name: point[0] * 1000,
    value: point[1],
  };
}

const EMPTY_STATS: ReadonlyArray<TimeseriesValue> = [];

type Props = {
  data: Group;
  statsPeriod: string;
  height?: number;
  showMarkLine?: boolean;
  showSecondaryPoints?: boolean;
};

function GroupChart({
  data,
  statsPeriod,
  showSecondaryPoints = false,
  showMarkLine = false,
}: Props) {
  const stats: ReadonlyArray<TimeseriesValue> = statsPeriod
    ? data.filtered
      ? data.filtered.stats?.[statsPeriod]
      : data.stats?.[statsPeriod]
    : EMPTY_STATS;

  const secondaryStats: TimeseriesValue[] | null =
    statsPeriod && data.filtered ? data.stats[statsPeriod] : null;

  const series: Series[] = useMemo(() => {
    if (!stats || !stats.length) {
      return [];
    }

    let max = 0;
    const marklinePoints: number[] = [];

    for (let i = 0; i < stats.length; i++) {
      const point = stats[i];
      if (point[1] > max) {
        max = point[1];
      }
      marklinePoints.push(point[1]);
    }

    const formattedMarkLine = formatAbbreviatedNumber(max);

    const chartSeries: Series[] = [];

    if (showSecondaryPoints && secondaryStats && secondaryStats.length) {
      chartSeries.push({
        seriesName: t('Total Events'),
        data: secondaryStats.map(asChartPoint),
      });
      chartSeries.push({
        seriesName: t('Matching Events'),
        data: stats.map(asChartPoint),
      });
    } else {
      // Colors are custom to preserve historical appearance where the single series is
      // considerably darker than the two series results.
      chartSeries.push({
        seriesName: t('Events'),
        data: stats.map(asChartPoint),
        markLine:
          showMarkLine && max > 0
            ? MarkLine({
                silent: true,
                lineStyle: {color: theme.gray200, type: 'dotted', width: 1},
                data: [
                  {
                    type: 'max',
                  },
                ],
                label: {
                  show: true,
                  position: 'start',
                  color: `${theme.gray200}`,
                  fontFamily: 'Rubik',
                  fontSize: 10,
                  formatter: `${formattedMarkLine}`,
                },
              })
            : undefined,
      });
    }
    return chartSeries;
  }, [showSecondaryPoints, secondaryStats, showMarkLine, stats]);

  return (
    <Fragment>
      <FastMiniBarChartContainer>
        <FastMiniBarChart series={series} />
      </FastMiniBarChartContainer>
    </Fragment>
  );
}

const FastMiniBarChartContainer = styled('div')`
  width: 200px;
  height: 50px;

  canvas {
    width: 100%;
    height: 100%;
  }
`;
export default GroupChart;
