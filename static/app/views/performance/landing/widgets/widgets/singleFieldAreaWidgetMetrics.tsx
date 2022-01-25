import {Fragment, useMemo} from 'react';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import _DurationChart from 'sentry/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformMetricsToArea} from '../transforms/transformMetricsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

import {DurationChart, HighlightNumber, Subtitle} from './singleFieldAreaWidget';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformMetricsToArea>;
};

export function SingleFieldAreaWidgetMetrics(props: PerformanceWidgetProps) {
  const api = useApi();
  const {
    ContainerActions,
    eventView,
    organization,
    chartSetting,
    chartColor,
    chartHeight,
    fields,
  } = props;

  const globalSelection = eventView.getPageFilters();

  if (fields.length !== 1) {
    throw new Error(`Single field area can only accept a single field (${fields})`);
  }

  const field = fields[0];

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: field,
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
          orgSlug={organization.slug}
          start={start}
          end={end}
          statsPeriod={period}
          project={project}
          environment={environment}
          query={new MutableSearch(eventView.query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
          field={decodeList(chartFields)}
          groupBy={
            chartSetting === PerformanceWidgetSetting.FAILURE_RATE_AREA
              ? ['transaction.status']
              : undefined
          }
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
      fields={[field]}
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
              chartColors={chartColor ? [chartColor] : undefined}
              disableMultiAxis
              disableXAxis
            />
          ),
          height: chartHeight,
        },
      ]}
    />
  );
}
