// eslint-disable-next-line no-restricted-imports
import {InjectedRouter, withRouter} from 'react-router';
import {Location} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart, LineChartProps} from 'sentry/components/charts/lineChart';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {DateString} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';

type Props = {
  data: Series[];
  end: DateString;
  location: Location;
  router: InjectedRouter;
  start: DateString;
  statsPeriod: string | undefined;
  height?: number;
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

  const chartOptions: Omit<LineChartProps, 'series'> = {
    legend: {
      right: 10,
      top: 5,
      data: [t('High Confidence'), t('Low Confidence')],
    },
    seriesOptions: {
      showSymbol: false,
    },
    height,
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, label) =>
        tooltipFormatter(value, aggregateOutputType(label)),
    },
    xAxis: undefined,
    yAxis: {
      axisLabel: {
        // Coerces the axis to be count based
        formatter: (value: number) => axisLabelFormatter(value, 'number'),
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
        <LineChart {...zoomRenderProps} series={data} {...chartOptions} />
      )}
    </ChartZoom>
  );
};

export const AnomalyChart = withRouter(_AnomalyChart);
