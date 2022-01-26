import {useMemo} from 'react';
import styled from '@emotion/styled';
import color from 'color';
import {Location} from 'history';
import pick from 'lodash/pick';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {LineChartSeries} from 'sentry/components/charts/lineChart';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import AnomaliesQuery, {
  AnomalyInfo,
  AnomalyPayload,
} from 'sentry/utils/performance/anomalies/anomaliesQuery';
import theme from 'sentry/utils/theme';
import _DurationChart from 'sentry/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../../landing/widgets/components/performanceWidget';
import {WidgetEmptyStateWarning} from '../../landing/widgets/components/selectableList';
import {QueryDefinition, WidgetDataResult} from '../../landing/widgets/types';
import {
  PerformanceWidgetSetting,
  WIDGET_DEFINITIONS,
} from '../../landing/widgets/widgetDefinitions';
import {SetStateAction} from '../types';

import AnomaliesTable from './anomaliesTable';
import {AnomalyChart} from './anomalyChart';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  projectId: string;
  setError: SetStateAction<string | undefined>;
  transactionName: string;
};

const anomalyAreaName = (anomaly: AnomalyInfo) => `#${anomaly.id}`;
const transformAnomalyToArea = (
  anomaly: AnomalyInfo
): [{name: string; xAxis: number}, {xAxis: number}] => [
  {name: anomalyAreaName(anomaly), xAxis: anomaly.start},
  {xAxis: anomaly.end},
];

const transformAnomalyData = (_: any, results: {data: AnomalyPayload}) => {
  const data: LineChartSeries[] = [];
  const resultData = results.data;

  if (!resultData) {
    return {
      isLoading: false,
      isErrored: false,
      data: undefined,
      hasData: false,
      loading: false,
    };
  }

  data.push({
    seriesName: 'tpm()',
    data: resultData.y.data.map(([name, [{count}]]) => ({
      name,
      value: count,
    })),
  });
  data.push({
    seriesName: 'tpm() lower bound',
    data: resultData.yhat_lower.data.map(([name, [{count}]]) => ({
      name,
      value: count,
    })),
  });
  data.push({
    seriesName: 'tpm() upper bound',
    data: resultData.yhat_upper.data.map(([name, [{count}]]) => ({
      name,
      value: count,
    })),
  });

  const anomalies = results.data.anomalies;
  const highConfidenceAreas = anomalies
    .filter(a => a.confidence === 'high')
    .map(transformAnomalyToArea);
  const highConfidenceLines = anomalies
    .filter(a => a.confidence === 'high')
    .map(area => ({xAxis: area.start, name: anomalyAreaName(area)}));

  const lowConfidenceAreas = anomalies
    .filter(a => a.confidence === 'low')
    .map(transformAnomalyToArea);
  const lowConfidenceLines = anomalies
    .filter(a => a.confidence === 'low')
    .map(area => ({xAxis: area.start, name: anomalyAreaName(area)}));

  data.push({
    seriesName: 'High Confidence',
    color: theme.red300,
    data: [],
    silent: true,
    markLine: MarkLine({
      animation: false,
      lineStyle: {color: theme.red300, type: 'solid', width: 1, opacity: 1.0},
      data: highConfidenceLines,
      label: {
        show: true,
        rotate: 90,
        color: theme.red300,
        position: 'insideEndBottom',
        fontSize: '10',
        offset: [5, 5],
        formatter: obj => `${(obj.data as any).name}`,
      },
    }),
    markArea: MarkArea({
      itemStyle: {
        color: color(theme.red300).alpha(0.2).rgb().string(),
      },
      label: {
        show: false,
      },
      data: highConfidenceAreas,
    }),
  });

  data.push({
    seriesName: 'Low Confidence',
    color: theme.yellow200,
    data: [],
    markLine: MarkLine({
      animation: false,
      lineStyle: {color: theme.yellow200, type: 'solid', width: 1, opacity: 1.0},
      data: lowConfidenceLines,
      label: {
        show: true,
        rotate: 90,
        color: theme.yellow300,
        position: 'insideEndBottom',
        fontSize: '10',
        offset: [5, 5],
        formatter: obj => `${(obj.data as any).name}`,
      },
    }),
    markArea: MarkArea({
      itemStyle: {
        color: color(theme.yellow200).alpha(0.2).rgb().string(),
      },
      label: {
        show: false,
      },
      data: lowConfidenceAreas,
    }),
  });

  return {
    isLoading: false,
    isErrored: false,
    data,
    hasData: true,
    loading: false,
  };
};

type AnomalyData = WidgetDataResult & ReturnType<typeof transformAnomalyData>;

type DataType = {
  chart: AnomalyData;
};

function Anomalies(props: Props) {
  const height = 250;
  const chartColor = theme.charts.colors[0];

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(() => {
    return {
      fields: '',
      component: provided => (
        <AnomaliesQuery
          orgSlug={props.organization.slug}
          location={props.location}
          eventView={props.eventView}
          {...pick(provided, 'children')}
        />
      ),
      transform: transformAnomalyData,
    };
  }, []);

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      title={t('Transaction Count')}
      titleTooltip={t(
        'Represents transaction count across time, with added visualizations to highlight anomalies in your data.'
      )}
      fields={['']}
      chartSetting={PerformanceWidgetSetting.TPM_AREA}
      chartDefinition={WIDGET_DEFINITIONS[PerformanceWidgetSetting.TPM_AREA]}
      Subtitle={() => <div />}
      HeaderActions={() => <div />}
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={{
        chart,
      }}
      Visualizations={[
        {
          component: provided => {
            const data =
              provided.widgetData.chart.data?.map(series => {
                if (series.seriesName !== 'tpm()') {
                  series.lineStyle = {type: 'dashed', color: chartColor, width: 1.5};
                }
                if (series.seriesName === 'score') {
                  series.lineStyle = {color: theme.red400};
                }
                return series;
              }) ?? [];

            return (
              <AnomalyChart
                {...provided}
                data={data}
                height={height}
                statsPeriod={undefined}
                start={null}
                end={null}
              />
            );
          },
          height,
        },
      ]}
    />
  );
}

function AnomaliesContent(props: Props) {
  return (
    <Layout.Main fullWidth>
      <Anomalies {...props} />
      <TableContainer>
        <AnomaliesQuery
          orgSlug={props.organization.slug}
          location={props.location}
          eventView={props.eventView}
        >
          {({data}) => (
            <AnomaliesTable anomalies={data?.anomalies} {...props} isLoading={false} />
          )}
        </AnomaliesQuery>
      </TableContainer>
    </Layout.Main>
  );
}

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;

export default AnomaliesContent;
