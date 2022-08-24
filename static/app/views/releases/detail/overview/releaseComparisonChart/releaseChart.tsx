// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart, LineChartProps} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PageFilters, SessionDisplayYAxis} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

type Props = {
  loading: boolean;
  selection: PageFilters;
  series: Series[];
  yAxis: SessionDisplayYAxis;
} & WithRouterProps;

function ReleaseChart({loading, router, selection, series, yAxis}: Props) {
  const {datetime} = selection;
  const {utc, start, end, period} = datetime;

  function chartComponent(chartProps: AreaChartProps | LineChartProps) {
    switch (yAxis) {
      case SessionDisplayYAxis.CRASH_FREE_SESSION_RATE:
      case SessionDisplayYAxis.CRASH_FREE_USER_RATE:
      case SessionDisplayYAxis.CRASHED_SESSION_RATE:
      case SessionDisplayYAxis.CRASHED_USER_RATE:
        return <LineChart {...chartProps} />;
      case SessionDisplayYAxis.SESSION_COUNT:
      case SessionDisplayYAxis.USER_COUNT:
      default:
        return <AreaChart stacked {...chartProps} />;
    }
  }

  return (
    <TransitionChart loading={loading} reloading={loading} height="240px">
      <LoadingScreen loading={loading} />
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

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LoadingScreen = ({loading}: {loading: boolean}) => {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
};
