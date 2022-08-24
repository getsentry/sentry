// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart, LineChartProps} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import {PageFilters, SessionDisplayYAxis} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

type Props = {
  loading: boolean;
  reloading: boolean;
  selection: PageFilters;
  series: Series[];
  yAxis: SessionDisplayYAxis;
} & WithRouterProps;

function ReleaseChart({loading, reloading, router, selection, series, yAxis}: Props) {
  const {datetime} = selection;
  const {utc, start, end, period} = datetime;

  function chartComponent(chartProps: AreaChartProps | LineChartProps) {
    switch (yAxis) {
      case SessionDisplayYAxis.CRASH_FREE_SESSION_RATE:
      case SessionDisplayYAxis.CRASH_FREE_USER_RATE:
      case SessionDisplayYAxis.CRASHED_SESSION_RATE:
      case SessionDisplayYAxis.CRASHED_USER_RATE:
        return <AreaChart stacked {...chartProps} />;
      case SessionDisplayYAxis.ABNORMAL_SESSIONS:
      case SessionDisplayYAxis.ABNORMAL_USERS:
      case SessionDisplayYAxis.CRASHED_SESSIONS:
      case SessionDisplayYAxis.CRASHED_USERS:
      case SessionDisplayYAxis.ERRORED_SESSIONS:
      case SessionDisplayYAxis.ERRORED_USERS:
      case SessionDisplayYAxis.HEALTHY_SESSIONS:
      case SessionDisplayYAxis.HEALTHY_USERS:
      case SessionDisplayYAxis.SESSION_COUNT:
      case SessionDisplayYAxis.USER_COUNT:
      case SessionDisplayYAxis.CRASH_FREE_SESSIONS:
      case SessionDisplayYAxis.CRASH_FREE_USERS:
      default:
        return <LineChart {...chartProps} />;
    }
  }

  return (
    <TransitionChart loading={loading} reloading={reloading} height="240px">
      <ChartZoom
        router={router}
        period={period}
        utc={utc}
        start={start}
        end={end}
        usePageDate
      >
        {zoomRenderProps =>
          chartComponent({
            series,
            ...zoomRenderProps,
            grid: {
              left: '10px',
              right: '10px',
              top: '70px',
              bottom: '0px',
            },
          })
        }
      </ChartZoom>
    </TransitionChart>
  );
}

export default withRouter(ReleaseChart);
