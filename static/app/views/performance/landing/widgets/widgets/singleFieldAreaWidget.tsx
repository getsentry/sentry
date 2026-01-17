import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval, getPreviousSeriesName} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import DurationChart from 'sentry/views/performance/charts/chart';
import {GenericPerformanceWidget} from 'sentry/views/performance/landing/widgets/components/performanceWidget';
import {transformDiscoverToSingleValue} from 'sentry/views/performance/landing/widgets/transforms/transformDiscoverToSingleValue';
import {transformEventsRequestToArea} from 'sentry/views/performance/landing/widgets/transforms/transformEventsToArea';
import type {
  PerformanceWidgetProps,
  QueryDefinition,
  WidgetDataResult,
} from 'sentry/views/performance/landing/widgets/types';
import {
  eventsRequestQueryProps,
  getMEPQueryParams,
  QUERY_LIMIT_PARAM,
} from 'sentry/views/performance/landing/widgets/utils';
import {EAP_QUERY_PARAMS} from 'sentry/views/performance/landing/widgets/widgets/settings';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  overall: WidgetDataResult & ReturnType<typeof transformDiscoverToSingleValue>;
};

export function SingleFieldAreaWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {ContainerActions, InteractiveTitle} = props;
  const globalSelection = props.eventView.getPageFilters();
  const {setPageDanger} = usePageAlert();
  const mepSetting = useMEPSettingContext();
  const useEap = useInsightsEap();

  const queryExtras = useEap
    ? {
        ...getMEPQueryParams(mepSetting),
        ...EAP_QUERY_PARAMS,
      }
    : getMEPQueryParams(mepSetting);

  if (props.fields.length !== 1) {
    throw new Error(`Single field area can only accept a single field (${props.fields})`);
  }
  const field = props.fields[0];

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: props.fields[0]!,
      component: provided => (
        <EventsRequest
          {...pick(provided, eventsRequestQueryProps)}
          includeAllArgs={false}
          limit={1}
          includePrevious
          includeTransformedData
          partial
          currentSeriesNames={[field!]}
          previousSeriesNames={[getPreviousSeriesName(field!)]}
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
          onError={setPageDanger}
          queryExtras={queryExtras}
        />
      ),
      transform: transformEventsRequestToArea,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, mepSetting.memoizationKey]
  );

  const overallQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: field!,
      component: provided => {
        const eventView = provided.eventView.clone();

        eventView.sorts = [];
        eventView.fields = props.fields.map(fieldName => ({field: fieldName}));

        return (
          <DiscoverQuery
            {...provided}
            limit={QUERY_LIMIT_PARAM}
            eventView={eventView}
            location={location}
            queryExtras={queryExtras}
          />
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
                const value =
                  provided.widgetData?.overall?.[fieldName as keyof WidgetDataResult];

                if (!value) {
                  return null;
                }

                return (
                  <HighlightNumber key={fieldName} color={props.chartColor}>
                    {axisLabelFormatter(value as any, aggregateOutputType(fieldName))}
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
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.md};
`;

const HighlightNumber = styled('div')<{color?: string}>`
  color: ${p => p.color};
  font-size: ${p => p.theme.fontSize.xl};
`;
