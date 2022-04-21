import {Fragment, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {LineChartSeries} from 'sentry/components/charts/lineChart';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import AnomaliesQuery, {
  AnomalyInfo,
  AnomalyPayload,
  ChildrenProps,
} from 'sentry/utils/performance/anomalies/anomaliesQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import theme from 'sentry/utils/theme';

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
  eventView: EventView;
  location: Location;
  organization: Organization;
  projectId: string;
  setError: SetStateAction<string | undefined>;
  transactionName: string;
};

type AnomaliesSectionProps = Props & {
  queryData: ChildrenProps;
};

const anomalyAreaName = (anomaly: AnomalyInfo) => `#${anomaly.id}`;
const transformAnomalyToArea = (
  anomaly: AnomalyInfo
): [{name: string; xAxis: number}, {xAxis: number}] => [
  {name: anomalyAreaName(anomaly), xAxis: anomaly.start},
  {xAxis: anomaly.end},
];

const transformAnomalyData = (
  _: any,
  results: {data: AnomalyPayload; error: null | string; isLoading: boolean}
) => {
  const data: LineChartSeries[] = [];
  const resultData = results.data;

  if (!resultData) {
    return {
      isLoading: results.isLoading,
      isErrored: !!results.error,
      data: undefined,
      hasData: false,
      loading: results.isLoading,
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
        color: theme.red300,
        opacity: 0.2,
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
        color: theme.yellow200,
        opacity: 0.2,
      },
      label: {
        show: false,
      },
      data: lowConfidenceAreas,
    }),
  });

  return {
    isLoading: results.isLoading,
    isErrored: !!results.error,
    data,
    hasData: true,
    loading: results.isLoading,
  };
};

type AnomalyData = WidgetDataResult & ReturnType<typeof transformAnomalyData>;

type DataType = {
  chart: AnomalyData;
};

function Anomalies(props: AnomaliesSectionProps) {
  const height = 250;
  const chartColor = theme.charts.colors[0];

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(() => {
    return {
      fields: '',
      component: provided => <Fragment>{provided.children(props.queryData)}</Fragment>,
      transform: transformAnomalyData,
    };
  }, [props.eventView, props.queryData]);

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
  const {location, organization, eventView} = props;
  const query = decodeScalar(location.query.query, '');

  function handleChange(key: string) {
    return function (value: string | undefined) {
      const queryParams = normalizeDateTimeParams({
        ...(location.query || {}),
        [key]: value,
      });

      // do not propagate pagination when making a new search
      const toOmit = ['cursor'];
      if (!defined(value)) {
        toOmit.push(key);
      }
      const searchQueryParams = omit(queryParams, toOmit);

      browserHistory.push({
        ...location,
        query: searchQueryParams,
      });
    };
  }
  return (
    <Layout.Main fullWidth>
      <SearchBar
        organization={organization}
        projectIds={eventView.project}
        query={query}
        fields={eventView.fields}
        onSearch={handleChange('query')}
      />
      <AnomaliesQuery
        organization={organization}
        location={location}
        eventView={eventView}
      >
        {queryData => (
          <Fragment>
            <Container>
              <Anomalies {...props} queryData={queryData} />
            </Container>
            <Container>
              <AnomaliesTable
                anomalies={queryData.data?.anomalies}
                {...props}
                isLoading={queryData.isLoading}
              />
            </Container>
          </Fragment>
        )}
      </AnomaliesQuery>
    </Layout.Main>
  );
}

const Container = styled('div')`
  margin-top: ${space(2)};
`;

export default AnomaliesContent;
