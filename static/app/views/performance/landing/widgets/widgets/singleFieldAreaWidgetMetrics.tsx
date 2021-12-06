import {Fragment, useMemo} from 'react';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {decodeList} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import _DurationChart from 'sentry/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformMetricsToArea} from '../transforms/transformMetricsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {ChartDefinition, PerformanceWidgetSetting} from '../widgetDefinitions';

import {DurationChart, HighlightNumber, Subtitle} from './singleFieldAreaWidget';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformMetricsToArea>;
};

export function SingleFieldAreaWidgetMetrics(
  props: PerformanceWidgetProps & {
    widgetDefinitions: Record<PerformanceWidgetSetting, ChartDefinition>;
  }
) {
  const api = useApi();
  const {
    ContainerActions,
    eventView,
    organization,
    chartSetting,
    chartColor,
    chartHeight,
    fields,
    widgetDefinitions,
  } = props;

  const globalSelection = eventView.getGlobalSelection();

  if (fields.length !== 1) {
    throw new Error(`Single field area can only accept a single field (${fields})`);
  }

  const field = fields[0];

  const {
    p50_duration_area,
    p75_duration_area,
    p95_duration_area,
    p99_duration_area,
    p75_lcp_area,
    tpm_area,
  } = widgetDefinitions;

  // TODO(metrics): make this list complete once api is ready
  const metricsFieldMap = {
    [p50_duration_area.fields[0]]: p50_duration_area.fields[0],
    [p75_duration_area.fields[0]]: p75_duration_area.fields[0],
    [p95_duration_area.fields[0]]: p95_duration_area.fields[0],
    [p99_duration_area.fields[0]]: p99_duration_area.fields[0],
    [p75_lcp_area.fields[0]]: p75_lcp_area.fields[0],
    [tpm_area.fields[0]]: 'count(transaction.duration)',
  };

  const metricsField = metricsFieldMap[field];

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: metricsField,
      component: ({
        start,
        end,
        period,
        project,
        environment,
        children,
        fields: chartFields,
      }) => (
        <MetricsRequest
          api={api}
          organization={organization}
          start={start}
          end={end}
          statsPeriod={period}
          project={project}
          environment={environment}
          query="transaction:foo" // TODO(metrics): make this dynamic once api is ready (widgetData.list.data[selectedListIndex].transaction)
          field={decodeList(chartFields)}
          includePrevious
        >
          {children}
        </MetricsRequest>
      ),
      transform: transformMetricsToArea,
    }),
    [chartSetting]
  );

  const Queries = {chart};

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      fields={[metricsField]}
      Subtitle={() => (
        <Subtitle>
          {globalSelection.datetime.period
            ? t('Compared to last %s ', globalSelection.datetime.period)
            : t('Compared to the last period')}
        </Subtitle>
      )}
      HeaderActions={provided => (
        <Fragment>
          <HighlightNumber color={chartColor}>
            {provided.widgetData.chart?.hasData
              ? provided.widgetData.chart?.dataMean?.[0].label
              : null}
          </HighlightNumber>
          <ContainerActions {...provided.widgetData.chart} />
        </Fragment>
      )}
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
            />
          ),
          height: chartHeight,
        },
      ]}
    />
  );
}
