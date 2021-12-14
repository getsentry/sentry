import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import MarkLine from 'sentry/components/charts/components/markLine';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getSeriesSelection} from 'sentry/components/charts/utils';
import {Panel} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {WebVital} from 'sentry/utils/discover/fields';
import {TransactionMetric} from 'sentry/utils/metrics/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';

import {ViewProps} from './types';
import {vitalToMetricsField, webVitalMeh, webVitalPoor} from './utils';

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    orgSlug: Organization['slug'];
    vital: WebVital;
  };

function VitalChart({
  project,
  environment,
  location,
  orgSlug,
  query,
  statsPeriod,
  router,
  start: propsStart,
  end: propsEnd,
  vital,
}: Props) {
  const api = useApi();
  const theme = useTheme();

  const handleLegendSelectChanged = legendChange => {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const utc = decodeScalar(router.location.query.utc) !== 'false';
  const field = `p75(${vitalToMetricsField[vital]})`;

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
  };

  const datetimeSelection = {
    start,
    end,
    period: statsPeriod,
  };

  const vitalPoor = webVitalPoor[vitalName];
  const vitalMeh = webVitalMeh[vitalName];

  const markLines = [
    {
      seriesName: 'Thresholds',
      type: 'line' as const,
      data: [],
      markLine: MarkLine({
        silent: true,
        lineStyle: {
          color: theme.red300,
          type: 'dashed',
          width: 1.5,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: t('Poor'),
        },
        data: [
          {
            yAxis: vitalPoor,
          } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
        ],
      }),
    },
    {
      seriesName: 'Thresholds',
      type: 'line' as const,
      data: [],
      markLine: MarkLine({
        silent: true,
        lineStyle: {
          color: theme.yellow300,
          type: 'dashed',
          width: 1.5,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: t('Meh'),
        },
        data: [
          {
            yAxis: vitalMeh,
          } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
        ],
      }),
    },
  ];

  const chartOptions = {
    grid: {
      left: '5px',
      right: '10px',
      top: '35px',
      bottom: '0px',
    },
    seriesOptions: {
      showSymbol: false,
    },
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (value: number, seriesName?: string) =>
        tooltipFormatter(value, vitalName === WebVital.CLS ? seriesName : yAxis),
    },
    yAxis: {
      min: 0,
      max: vitalPoor,
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        // coerces the axis to be time based
        formatter: (value: number) => axisLabelFormatter(value, yAxis),
      },
    },
  };

  return (
    <Panel>
      <ChartContainer>
        <HeaderTitleLegend>
          {t('Duration p75')}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(`The durations shown should fall under the vital threshold.`)}
          />
        </HeaderTitleLegend>
        <ChartZoom router={router} period={statsPeriod} start={start} end={end} utc={utc}>
          {zoomRenderProps => (
            <MetricsRequest
              api={api}
              orgSlug={orgSlug}
              start={start}
              end={end}
              statsPeriod={statsPeriod}
              project={projectIds}
              environment={environment}
              field={[field]}
              query={mutableSearch.formatString()} // TODO(metrics): not all tags will be compatible with metrics
              groupBy={['transaction', 'measurement_rating']}
            >
              {() => null}
            </MetricsRequest>
          )}
        </ChartZoom>
      </ChartContainer>
    </Panel>
  );
}

export default withRouter(VitalChart);
