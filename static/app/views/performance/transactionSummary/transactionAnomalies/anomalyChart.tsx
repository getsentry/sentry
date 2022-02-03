import {InjectedRouter, withRouter} from 'react-router';
import {Location} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import LineChart from 'sentry/components/charts/lineChart';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {DateString} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';

type Props = {
  data: Series[];
  statsPeriod: string | undefined;
  start: DateString;
  end: DateString;
  height?: number;
  location: Location;
  router: InjectedRouter;
};

const _AnomalyChart = (props: Props) => {
  const {
    data,
    location,
    statsPeriod,
    height,
    router,
    start: propsStart,
    end: propsEnd,
  } = props;

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  const legend = {
    right: 10,
    top: 5,
    data: [t('High Confidence'), t('Low Confidence')],
  };

  const chartOptions = {
    seriesOptions: {
      showSymbol: false,
    },
    height,
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: tooltipFormatter,
    },
    xAxis: undefined,
    yAxis: {
      axisLabel: {
        // p50() coerces the axis to be time based
        formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
      },
    },
  };

  return (
    <ChartZoom
      router={router}
      period={statsPeriod}
      start={start}
      end={end}
      utc={utc === 'true'}
    >
      {zoomRenderProps => (
        <LineChart {...zoomRenderProps} series={data} legend={legend} {...chartOptions} />
      )}
    </ChartZoom>
  );
};

export const AnomalyChart = withRouter(_AnomalyChart);
