import {useMemo} from 'react';
import {InjectedRouter} from 'react-router';
import {useTheme} from '@emotion/react';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {Panel} from 'sentry/components/panels';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {useProfileStats} from 'sentry/utils/profiling/hooks/useProfileStats';

interface ProfileChartsProps {
  query: string;
  router: InjectedRouter;
  selection?: PageFilters;
}

// We want p99 to be before p75 because echarts renders the series in order.
// So if p75 is before p99, p99 will be rendered on top of p75 which will
// cover it up.
const SERIES_ORDER = ['count()', 'p99()', 'p75()'];

export function ProfileCharts({query, router, selection}: ProfileChartsProps) {
  const theme = useTheme();

  const profileStats = useProfileStats({query, selection});
  const series: Series[] = useMemo(() => {
    if (profileStats.type !== 'resolved') {
      return [];
    }

    const timestamps = profileStats.data.timestamps;

    const allSeries = profileStats.data.data.map(rawData => {
      if (timestamps.length !== rawData.values.length) {
        throw new Error('Invalid stats response');
      }

      if (rawData.axis === 'count') {
        return {
          data: rawData.values.map((value, i) => ({
            name: timestamps[i] * 1e3,
            value: value ?? 0,
          })),
          seriesName: `${rawData.axis}()`,
          xAxisIndex: 0,
          yAxisIndex: 0,
        };
      }

      return {
        data: rawData.values.map((value, i) => ({
          name: timestamps[i] * 1e3,
          value: (value ?? 0) / 1e6, // convert ns to ms
        })),
        seriesName: `${rawData.axis}()`,
        xAxisIndex: 1,
        yAxisIndex: 1,
      };
    });

    allSeries.sort((a, b) => {
      const idxA = SERIES_ORDER.indexOf(a.seriesName);
      const idxB = SERIES_ORDER.indexOf(b.seriesName);

      return idxA - idxB;
    });

    return allSeries;
  }, [profileStats]);

  return (
    <ChartZoom router={router} {...selection?.datetime}>
      {zoomRenderProps => (
        <Panel>
          <AreaChart
            height={300}
            series={series}
            grid={[
              {
                top: '32px',
                left: '24px',
                right: '52%',
                bottom: '16px',
              },
              {
                top: '32px',
                left: '52%',
                right: '24px',
                bottom: '16px',
              },
            ]}
            legend={{
              right: 16,
              top: 12,
              data: ['p75()', 'p99()', 'count()'],
            }}
            axisPointer={{
              link: [{xAxisIndex: [0, 1]}],
            }}
            xAxes={[
              {
                gridIndex: 0,
                type: 'time' as const,
              },
              {
                gridIndex: 1,
                type: 'time' as const,
              },
            ]}
            yAxes={[
              {
                gridIndex: 0,
                scale: true,
                axisLabel: {
                  color: theme.chartLabel,
                  formatter(value: number) {
                    return axisLabelFormatter(value, 'count()');
                  },
                },
              },
              {
                gridIndex: 1,
                scale: true,
                axisLabel: {
                  color: theme.chartLabel,
                  formatter(value: number) {
                    return axisLabelFormatter(value, 'p75()');
                  },
                },
              },
            ]}
            tooltip={{
              valueFormatter: tooltipFormatter,
            }}
            isGroupedByDate
            showTimeInTooltip
            {...zoomRenderProps}
          />
        </Panel>
      )}
    </ChartZoom>
  );
}
