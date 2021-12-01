import {Fragment, useMemo} from 'react';
import {withRouter} from 'react-router';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {decodeList} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import _DurationChart from 'sentry/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformMetricsToArea} from '../transforms/transformMetricsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';

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
  const globalSelection = eventView.getGlobalSelection();

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
        fields: chatFields,
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
          interval={getInterval(
            {
              start,
              end,
              period,
            },
            'medium'
          )}
          field={decodeList(chatFields)}
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

const DurationChart = withRouter(_DurationChart);
const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const HighlightNumber = styled('div')<{color?: string}>`
  color: ${p => p.color};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
