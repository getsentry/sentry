import {Fragment, useMemo, useState} from 'react';
import {withRouter} from 'react-router';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import Count from 'sentry/components/count';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import _DurationChart from 'sentry/views/performance/charts/chart';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {excludeTransaction} from '../../utils';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {
  GrowLink,
  ListClose,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformMetricsToArea} from '../transforms/transformMetricsToArea';
import {transformMetricsToList} from '../transforms/transformMetricsToList';
import {
  GenericPerformanceWidgetProps,
  PerformanceWidgetProps,
  QueryDefinition,
  WidgetDataResult,
} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformMetricsToArea>;
  list: WidgetDataResult & ReturnType<typeof transformMetricsToList>;
};

const framesList = [
  PerformanceWidgetSetting.MOST_SLOW_FRAMES,
  PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
];

// This file is simpler than singleFieldAreaWidget because metrics for now support only MOST_SLOW_FRAMES and MOST_FROZEN_FRAMES
export function LineChartListWidgetMetrics(props: PerformanceWidgetProps) {
  const api = useApi();
  const [selectedListIndex, setSelectListIndex] = useState(0);
  const {
    ContainerActions,
    organization,
    fields,
    chartSetting,
    location,
    chartColor,
    chartHeight,
  } = props;
  const field = fields[0];
  const orgSlug = organization.slug;

  if (fields.length !== 1) {
    throw new Error(`Line chart list widget can only accept a single field (${fields})`);
  }

  if (!framesList.includes(chartSetting)) {
    throw new Error(
      `Line chart list widget on metrics supports only ${framesList.join(', ')}.`
    );
  }

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields,
      component: ({start, end, period, project, environment, children, eventView}) => (
        <MetricsRequest
          api={api}
          orgSlug={orgSlug}
          start={start}
          end={end}
          statsPeriod={period}
          project={project}
          environment={environment}
          query={new MutableSearch(eventView.query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
          field={[field]}
          groupBy={['transaction']}
          orderBy={`-${field}`}
          limit={3}
        >
          {children}
        </MetricsRequest>
      ),
      transform: transformMetricsToList,
    }),
    [chartSetting]
  );

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(() => {
    return {
      enabled: widgetData => {
        return !!widgetData?.list?.data?.length;
      },
      fields,
      component: ({
        start,
        end,
        period,
        project,
        environment,
        children,
        widgetData,
        eventView,
      }) => {
        if (!widgetData.list.data[selectedListIndex]?.transaction) {
          return null;
        }
        return (
          <MetricsRequest
            api={api}
            orgSlug={orgSlug}
            start={start}
            end={end}
            statsPeriod={period}
            project={project}
            environment={environment}
            query={new MutableSearch(eventView.query)
              .addFilterValues('transaction', [
                widgetData.list.data[selectedListIndex].transaction as string,
              ])
              .formatString()} // TODO(metrics): not all tags will be compatible with metrics
            field={decodeList(fields)}
            includePrevious
          >
            {children}
          </MetricsRequest>
        );
      },
      transform: (data: GenericPerformanceWidgetProps<DataType>, result) =>
        transformMetricsToArea(data, result),
    };
  }, [chartSetting, selectedListIndex]);

  const Queries = {
    list: listQuery,
    chart: chartQuery,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      Subtitle={() => <Subtitle>{t('Suggested transactions')}</Subtitle>}
      HeaderActions={provided => (
        <ContainerActions isLoading={provided.widgetData.list?.isLoading} />
      )}
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={Queries}
      Visualizations={[
        {
          component: provided => (
            <DurationChart
              {...provided.widgetData.chart}
              {...provided}
              disableMultiAxis
              disableXAxis
              chartColors={chartColor ? [chartColor] : undefined}
              isLineChart
            />
          ),
          height: chartHeight,
        },
        {
          component: provided => (
            <SelectableList
              selectedIndex={selectedListIndex}
              setSelectedIndex={setSelectListIndex}
              items={provided.widgetData.list.data.map(listItem => () => {
                const transaction = listItem.transaction as string | null;
                const countValue = listItem[field];

                if (!transaction) {
                  return null;
                }

                const transactionTarget = transactionSummaryRouteWithQuery({
                  orgSlug,
                  projectID: decodeList(location.query.project), // TODO(metrics): filter by project once api supports it (listItem['project.id'])
                  transaction,
                  query: props.eventView.getPageFiltersQuery(),
                });

                return (
                  <Fragment>
                    <GrowLink to={transactionTarget}>
                      <Truncate value={transaction} maxLength={40} />
                    </GrowLink>
                    <RightAlignedCell>
                      {defined(countValue) ? <Count value={countValue} /> : '\u2014'}
                    </RightAlignedCell>
                    <ListClose
                      setSelectListIndex={setSelectListIndex}
                      onClick={() => excludeTransaction(transaction, props)}
                    />
                  </Fragment>
                );
              })}
            />
          ),
          height: 124,
          noPadding: true,
        },
      ]}
    />
  );
}

const DurationChart = withRouter(_DurationChart);
