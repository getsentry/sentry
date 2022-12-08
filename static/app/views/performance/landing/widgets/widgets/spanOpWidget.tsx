import {Fragment, useMemo, useState} from 'react';
import pick from 'lodash/pick';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {t, tct} from 'sentry/locale';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import DurationChart from 'sentry/views/performance/charts/chart';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  getPerformanceDuration,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';

import {excludeTransaction} from '../../utils';
import Accordion from '../components/accordion';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import {
  GrowLink,
  ListClose,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {eventsRequestQueryProps, getMEPParamsIfApplicable} from '../utils';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

export function SpanOpWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const mepSetting = useMEPSettingContext();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions, organization, InteractiveTitle, fields} = props;
  const pageError = usePageError();

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields,
      component: provided => {
        const eventView = provided.eventView.clone();

        eventView.fields = [
          {field: 'transaction'},
          {field: 'team_key_transaction'},
          {field: 'count()'},
        ];

        eventView.sorts = [
          {kind: 'desc', field: 'team_key_transaction'},
          {kind: 'desc', field: 'count()'},
        ];

        if (canUseMetricsData(organization)) {
          eventView.additionalConditions.setFilterValues('!transaction', [
            UNPARAMETERIZED_TRANSACTION,
          ]);
        }
        const mutableSearch = new MutableSearch(eventView.query);
        mutableSearch.removeFilter('transaction.duration');

        // TODO check if needed
        eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.
        eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.

        eventView.query = mutableSearch.formatString();

        // Don't retrieve list items with 0 in the field.
        eventView.additionalConditions.setFilterValues('count()', ['>0']);
        return (
          <DiscoverQuery
            {...provided}
            eventView={eventView}
            location={location}
            limit={3}
            cursor="0:0:1"
            noPagination
            queryExtras={getMEPParamsIfApplicable(mepSetting, props.chartSetting)}
            useEvents
          />
        );
      },
      transform: transformDiscoverToList,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, mepSetting.memoizationKey]
  );

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => {
      return {
        enabled: widgetData => {
          return !!widgetData?.list?.data?.length;
        },
        fields,
        component: provided => {
          const eventView = props.eventView.clone();
          if (!provided.widgetData.list.data[selectedListIndex]?.transaction) {
            return null;
          }
          eventView.additionalConditions.setFilterValues('transaction', [
            provided.widgetData.list.data[selectedListIndex].transaction as string,
          ]);

          if (canUseMetricsData(organization)) {
            eventView.additionalConditions.setFilterValues('!transaction', [
              UNPARAMETERIZED_TRANSACTION,
            ]);
          }

          return (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              limit={6}
              includePrevious={false}
              includeTransformedData
              partial
              currentSeriesNames={fields}
              query={eventView.getQueryWithAdditionalConditions()}
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
              queryExtras={getMEPParamsIfApplicable(mepSetting, props.chartSetting)}
            />
          );
        },
        transform: transformEventsRequestToArea,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, selectedListIndex, mepSetting.memoizationKey]
  );

  const Queries = {
    list: listQuery,
    chart: chartQuery,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      location={location}
      Subtitle={() => <Subtitle>{t('Suggested transactions')}</Subtitle>}
      HeaderActions={provided =>
        ContainerActions && (
          <ContainerActions isLoading={provided.widgetData.list?.isLoading} />
        )
      }
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData.chart} />
          : null
      }
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={Queries}
      Visualizations={[
        {
          component: provided => (
            <Accordion
              expandedIndex={selectedListIndex}
              setExpandedIndex={setSelectListIndex}
              content={
                <DurationChart
                  {...provided.widgetData.chart}
                  {...provided}
                  disableMultiAxis={false}
                  disableXAxis
                  chartColors={props.chartColor ? [props.chartColor] : undefined}
                  isLineChart
                />
              }
              headers={provided.widgetData.list.data.map(listItem => () => {
                const transaction = (listItem.transaction as string | undefined) ?? '';

                const additionalQuery: Record<string, string> = {};
                const isUnparameterizedRow = transaction === UNPARAMETERIZED_TRANSACTION;
                const transactionTarget = isUnparameterizedRow
                  ? createUnnamedTransactionsDiscoverTarget({
                      organization,
                      location,
                    })
                  : transactionSummaryRouteWithQuery({
                      orgSlug: props.organization.slug,
                      projectID: listItem['project.id'] as string,
                      transaction,
                      query: props.eventView.getPageFiltersQuery(),
                      additionalQuery,
                    });

                const fieldString = fields[0];

                const valueMap = {
                  [PerformanceWidgetSetting.MOST_RELATED_ERRORS]: listItem.failure_count,
                  [PerformanceWidgetSetting.MOST_RELATED_ISSUES]: listItem.issue,
                  slowest: getPerformanceDuration(listItem[fieldString] as number),
                };
                const rightValue = valueMap[props.chartSetting] ?? listItem[fieldString];

                switch (props.chartSetting) {
                  case PerformanceWidgetSetting.MOST_RELATED_ISSUES:
                    return (
                      <Fragment>
                        <GrowLink to={transactionTarget}>
                          <Truncate value={transaction} maxLength={40} />
                        </GrowLink>
                        <RightAlignedCell>
                          <Tooltip title={listItem.title}>
                            <Link
                              to={`/organizations/${props.organization.slug}/issues/${listItem['issue.id']}/?referrer=performance-line-chart-widget`}
                            >
                              {rightValue}
                            </Link>
                          </Tooltip>
                        </RightAlignedCell>
                        {!props.withStaticFilters && (
                          <ListClose
                            setSelectListIndex={setSelectListIndex}
                            onClick={() =>
                              excludeTransaction(listItem.transaction, {
                                eventView: props.eventView,
                                location,
                              })
                            }
                          />
                        )}
                      </Fragment>
                    );
                  case PerformanceWidgetSetting.MOST_RELATED_ERRORS:
                    return (
                      <Fragment>
                        <GrowLink to={transactionTarget}>
                          <Truncate value={transaction} maxLength={40} />
                        </GrowLink>
                        <RightAlignedCell>
                          {tct('[count] errors', {
                            count: <Count value={rightValue} />,
                          })}
                        </RightAlignedCell>
                        {!props.withStaticFilters && (
                          <ListClose
                            setSelectListIndex={setSelectListIndex}
                            onClick={() =>
                              excludeTransaction(listItem.transaction, {
                                eventView: props.eventView,
                                location,
                              })
                            }
                          />
                        )}
                      </Fragment>
                    );
                  default:
                    if (typeof rightValue === 'number') {
                      return (
                        <Fragment>
                          <GrowLink to={transactionTarget}>
                            <Truncate value={transaction} maxLength={40} />
                          </GrowLink>
                          <RightAlignedCell>
                            <Count value={rightValue} />
                          </RightAlignedCell>
                          {!props.withStaticFilters && (
                            <ListClose
                              setSelectListIndex={setSelectListIndex}
                              onClick={() =>
                                excludeTransaction(listItem.transaction, {
                                  eventView: props.eventView,
                                  location,
                                })
                              }
                            />
                          )}
                        </Fragment>
                      );
                    }
                    return (
                      <Fragment>
                        <GrowLink to={transactionTarget}>
                          <Truncate value={transaction} maxLength={40} />
                        </GrowLink>
                        <RightAlignedCell>{rightValue}</RightAlignedCell>
                        {!props.withStaticFilters && (
                          <ListClose
                            setSelectListIndex={setSelectListIndex}
                            onClick={() =>
                              excludeTransaction(listItem.transaction, {
                                eventView: props.eventView,
                                location,
                              })
                            }
                          />
                        )}
                      </Fragment>
                    );
                }
              })}
            />
          ),
          height: 124 + props.chartHeight,
          noPadding: true,
        },
      ]}
    />
  );
}

const EventsRequest = withApi(_EventsRequest);
