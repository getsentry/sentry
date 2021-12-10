import {Fragment, useMemo} from 'react';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
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

function getMetricsField(field: string) {
  const parsedField = parseFunction(field);

  if (!parsedField) {
    return field;
  }

  const {name, arguments: args} = parsedField;

  if (!args[0]) {
    return field;
  }

  if (args[0].includes('measurements')) {
    return `${name}(sentry.transactions.${args[0]})`;
  }

  return `${name}(sentry.sessions.${args[0]})`;
}

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

  const metricsFieldMap = {
    [widgetDefinitions.tpm_area.fields[0]]: 'count(transaction.duration)',
    [widgetDefinitions.failure_rate_area.fields[0]]: 'count(transaction.duration)',
  };

  const metricsField = getMetricsField(metricsFieldMap[field] ?? field);

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
          query={new MutableSearch(eventView.query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
          field={decodeList(chartFields)}
          groupBy={
            field === widgetDefinitions.failure_rate_area.fields[0]
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
