import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval, getPreviousSeriesName} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  QueryBatchNode,
  Transform,
} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import DurationChart from 'sentry/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformDiscoverToSingleValue} from '../transforms/transformDiscoverToSingleValue';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {eventsRequestQueryProps, getMEPQueryParams, QUERY_LIMIT_PARAM} from '../utils';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  overall: WidgetDataResult & ReturnType<typeof transformDiscoverToSingleValue>;
};

export function SingleFieldAreaWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {ContainerActions, InteractiveTitle} = props;
  const globalSelection = props.eventView.getPageFilters();
  const pageError = usePageError();
  const mepSetting = useMEPSettingContext();

  if (props.fields.length !== 1) {
    throw new Error(`Single field area can only accept a single field (${props.fields})`);
  }
  const field = props.fields[0];

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: props.fields[0],
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
              currentSeriesNames={[field]}
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

  const overallQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: field,
      component: provided => {
        const eventView = provided.eventView.clone();

        eventView.sorts = [];
        eventView.fields = props.fields.map(fieldName => ({field: fieldName}));

        return (
          <QueryBatchNode batchProperty="field">
            {({queryBatching}) => (
              <DiscoverQuery
                {...provided}
                limit={QUERY_LIMIT_PARAM}
                queryBatching={queryBatching}
                eventView={eventView}
                location={location}
                queryExtras={getMEPQueryParams(mepSetting)}
              />
            )}
          </QueryBatchNode>
        );
      },
      transform: transformDiscoverToSingleValue,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, mepSetting.memoizationKey]
  );

  const Queries = {
    chart: chartQuery,
    overall: overallQuery,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      location={location}
      Subtitle={() => (
        <Subtitle>
          {globalSelection.datetime.period
            ? t('Compared to last %s ', globalSelection.datetime.period)
            : t('Compared to the last period')}
        </Subtitle>
      )}
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData.chart} />
          : null
      }
      HeaderActions={provided => (
        <Fragment>
          {provided.widgetData?.overall?.hasData ? (
            <Fragment>
              {props.fields.map(fieldName => {
                const value = provided.widgetData?.overall?.[fieldName];

                if (!value) {
                  return null;
                }

                return (
                  <HighlightNumber key={fieldName} color={props.chartColor}>
                    {axisLabelFormatter(value, aggregateOutputType(fieldName))}
                  </HighlightNumber>
                );
              })}
            </Fragment>
          ) : null}
          {ContainerActions && <ContainerActions {...provided.widgetData.chart} />}
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
              definedAxisTicks={4}
              chartColors={props.chartColor ? [props.chartColor] : undefined}
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
