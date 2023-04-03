import {useMemo} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval, getPreviousSeriesName} from 'sentry/components/charts/utils';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {
  QueryBatchNode,
  Transform,
} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import DurationChart from 'sentry/views/starfish/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformDiscoverToSingleValue} from '../transforms/transformDiscoverToSingleValue';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {eventsRequestQueryProps, getMEPQueryParams} from '../utils';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  overall: WidgetDataResult & ReturnType<typeof transformDiscoverToSingleValue>;
};

export function StackedAreaWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {InteractiveTitle} = props;
  const pageError = usePageError();
  const mepSetting = useMEPSettingContext();

  const field = props.fields[0];

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: props.fields,
      component: provided => (
        <QueryBatchNode batchProperty="yAxis" transform={unmergeIntoIndividualResults}>
          {({queryBatching}) => (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              limit={1}
              queryBatching={queryBatching}
              includePrevious
              includeTransformedData
              partial
              currentSeriesNames={props.fields}
              previousSeriesNames={[getPreviousSeriesName(field)]}
              query={provided.eventView.getQueryWithAdditionalConditions()}
              interval={getInterval(
                {
                  start: provided.start,
                  end: provided.end,
                  period: provided.period,
                },
                'medium'
              )}
              hideError
              onError={pageError.setPageError}
              queryExtras={getMEPQueryParams(mepSetting)}
            />
          )}
        </QueryBatchNode>
      ),
      transform: transformEventsRequestToArea,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, mepSetting.memoizationKey]
  );

  const Queries = {
    chart: chartQuery,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      location={location}
      Subtitle={() => <Subtitle>p95 db vs http</Subtitle>}
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData.chart} />
          : null
      }
      Queries={Queries}
      Visualizations={[
        {
          component: provided => (
            <DurationChart
              {...provided.widgetData.chart}
              {...provided}
              disableMultiAxis
              disableXAxis
              definedAxisTicks={4}
              chartColors={props.chartColor ? [props.chartColor] : CHART_PALETTE[5]}
              isLineChart
            />
          ),
          height: props.chartHeight,
        },
      ]}
    />
  );
}

const EventsRequest = withApi(_EventsRequest);
export const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export const HighlightNumber = styled('div')<{color?: string}>`
  color: ${p => p.color};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const unmergeIntoIndividualResults: Transform = (response, queryDefinition) => {
  const propertyName = Array.isArray(
    queryDefinition.requestQueryObject.query[queryDefinition.batchProperty]
  )
    ? queryDefinition.requestQueryObject.query[queryDefinition.batchProperty][0]
    : queryDefinition.requestQueryObject.query[queryDefinition.batchProperty];

  return response[propertyName];
};
