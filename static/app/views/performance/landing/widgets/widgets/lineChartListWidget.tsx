import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Accordion from 'sentry/components/accordion/accordion';
import {LinkButton} from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {t, tct} from 'sentry/locale';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/performance/browser/resources/resourceView';
import {getResourcesEventViewQuery} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import DurationChart from 'sentry/views/performance/charts/chart';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  getPerformanceDuration,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';
import {SpanDescriptionCell} from 'sentry/views/starfish/components/tableCells/spanDescriptionCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {RoutingContextProvider} from 'sentry/views/starfish/utils/routingContext';

import {excludeTransaction} from '../../utils';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {
  GrowLink,
  ListClose,
  RightAlignedCell,
  Subtitle,
  TimeSpentInDatabaseWidgetEmptyStateWarning,
  WidgetAddInstrumentationWarning,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {
  eventsRequestQueryProps,
  getMEPParamsIfApplicable,
  QUERY_LIMIT_PARAM,
  TOTAL_EXPANDABLE_ROWS_HEIGHT,
} from '../utils';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

const slowList = [
  PerformanceWidgetSetting.SLOW_HTTP_OPS,
  PerformanceWidgetSetting.SLOW_DB_OPS,
  PerformanceWidgetSetting.SLOW_BROWSER_OPS,
  PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
];

// Most N Frames, low population, and count vs. duration so treated separately from 'slow' widgets.
const framesList = [
  PerformanceWidgetSetting.MOST_SLOW_FRAMES,
  PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
];

const integrationEmptyStateWidgets = [
  PerformanceWidgetSetting.SLOW_DB_OPS,
  PerformanceWidgetSetting.SLOW_HTTP_OPS,
];

export function LineChartListWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const mepSetting = useMEPSettingContext();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions, organization, InteractiveTitle} = props;
  const pageError = usePageError();
  const canHaveIntegrationEmptyState = integrationEmptyStateWidgets.includes(
    props.chartSetting
  );

  let emptyComponent;
  if (props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES) {
    emptyComponent = TimeSpentInDatabaseWidgetEmptyStateWarning;
  } else {
    emptyComponent = canHaveIntegrationEmptyState
      ? () => (
          <WidgetAddInstrumentationWarning
            type={
              props.chartSetting === PerformanceWidgetSetting.SLOW_DB_OPS ? 'db' : 'http'
            }
          />
        )
      : WidgetEmptyStateWarning;
  }

  const field = props.fields[0];

  if (props.fields.length !== 1 && !canHaveIntegrationEmptyState) {
    throw new Error(
      `Line chart list widget can only accept a single field (${props.fields})`
    );
  }

  const isSlowestType = slowList.includes(props.chartSetting);
  const isFramesType = framesList.includes(props.chartSetting);

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: field,
      component: provided => {
        const eventView = provided.eventView.clone();
        let extraQueryParams = getMEPParamsIfApplicable(mepSetting, props.chartSetting);
        eventView.sorts = [{kind: 'desc', field}];
        if (props.chartSetting === PerformanceWidgetSetting.MOST_RELATED_ISSUES) {
          eventView.fields = [
            {field: 'issue'},
            {field: 'transaction'},
            {field: 'title'},
            {field: 'project.id'},
            {field},
          ];
          eventView.additionalConditions.setFilterValues('event.type', ['error']);
          eventView.additionalConditions.setFilterValues('!tags[transaction]', ['']);
          if (canUseMetricsData(organization)) {
            eventView.additionalConditions.setFilterValues('!transaction', [
              UNPARAMETERIZED_TRANSACTION,
            ]);
          }
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('transaction.duration');
          eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.
          eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.
          eventView.query = mutableSearch.formatString();
        } else if (
          props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES
        ) {
          // Set fields
          eventView.fields = [
            {field: SpanMetricsField.SPAN_OP},
            {field: SpanMetricsField.SPAN_GROUP},
            {field: 'project.id'},
            {field: SpanMetricsField.SPAN_DESCRIPTION},
            {field: `sum(${SpanMetricsField.SPAN_SELF_TIME})`},
            {field: `avg(${SpanMetricsField.SPAN_SELF_TIME})`},
            {field},
          ];

          // Change data set to spansMetrics
          eventView.dataset = DiscoverDatasets.SPANS_METRICS;
          extraQueryParams = {
            ...extraQueryParams,
            dataset: DiscoverDatasets.SPANS_METRICS,
          };

          // Update query
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('event.type');
          eventView.additionalConditions.removeFilter('event.type');
          eventView.additionalConditions.removeFilter('time_spent_percentage()');
          mutableSearch.addFilterValue('has', 'span.description');
          mutableSearch.addFilterValue('span.module', 'db');
          eventView.query = mutableSearch.formatString();
        } else if (
          props.chartSetting === PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES
        ) {
          // Set fields
          eventView.fields = [
            {field: SpanMetricsField.SPAN_DESCRIPTION},
            {field: SpanMetricsField.SPAN_OP},
            {field: 'project.id'},
            {field: SpanMetricsField.SPAN_GROUP},
            {field: `sum(${SpanMetricsField.SPAN_SELF_TIME})`},
            {field: `avg(${SpanMetricsField.SPAN_SELF_TIME})`},
            {field},
          ];

          // Change data set to spansMetrics
          eventView.dataset = DiscoverDatasets.SPANS_METRICS;
          extraQueryParams = {
            ...extraQueryParams,
            dataset: DiscoverDatasets.SPANS_METRICS,
          };

          // Update query
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('event.type');
          mutableSearch.removeFilter('time_spent_percentage()');
          eventView.additionalConditions.removeFilter('event.type');
          eventView.additionalConditions.removeFilter('time_spent_percentage()');
          eventView.query = `${mutableSearch.formatString()} ${getResourcesEventViewQuery(
            {'resource.render_blocking_status': 'blocking'},
            DEFAULT_RESOURCE_TYPES
          ).join(' ')}`;
        } else if (isSlowestType || isFramesType) {
          eventView.additionalConditions.setFilterValues('epm()', ['>0.01']);
          eventView.fields = [
            {field: 'transaction'},
            {field: 'project.id'},
            {field: 'epm()'},
            ...props.fields.map(f => ({field: f})),
          ];
        } else {
          // Most related errors
          eventView.fields = [{field: 'transaction'}, {field: 'project.id'}, {field}];
        }
        // Don't retrieve list items with 0 in the field.
        if (
          ![
            PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES,
            PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES,
          ].includes(props.chartSetting)
        ) {
          eventView.additionalConditions.setFilterValues(field, ['>0']);
        }

        return (
          <DiscoverQuery
            {...provided}
            eventView={eventView}
            location={location}
            limit={QUERY_LIMIT_PARAM}
            cursor="0:0:1"
            noPagination
            queryExtras={extraQueryParams}
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
        fields: field,
        component: provided => {
          const eventView = props.eventView.clone();
          let extraQueryParams = getMEPParamsIfApplicable(mepSetting, props.chartSetting);
          const pageFilterDatetime = {
            start: provided.start,
            end: provided.end,
            period: provided.period,
          };

          // Chart options
          let currentSeriesNames = [field];
          let includePreviousParam = true;
          let yAxis = provided.yAxis;
          let interval = getInterval(pageFilterDatetime, 'medium');
          let partialDataParam = true;

          if (
            !provided.widgetData.list.data[selectedListIndex] ||
            (!provided.widgetData.list.data[selectedListIndex]?.transaction &&
              !provided.widgetData.list.data[selectedListIndex][
                SpanMetricsField.SPAN_DESCRIPTION
              ])
          ) {
            return null;
          }
          eventView.additionalConditions.setFilterValues('transaction', [
            provided.widgetData.list.data[selectedListIndex].transaction as string,
          ]);
          if (props.chartSetting === PerformanceWidgetSetting.MOST_RELATED_ISSUES) {
            if (!provided.widgetData.list.data[selectedListIndex]?.issue) {
              return null;
            }
            eventView.fields = [
              {field: 'issue'},
              {field: 'issue.id'},
              {field: 'transaction'},
              {field},
            ];
            eventView.additionalConditions.setFilterValues('issue', [
              provided.widgetData.list.data[selectedListIndex].issue as string,
            ]);
            eventView.additionalConditions.setFilterValues('event.type', ['error']);

            if (canUseMetricsData(organization)) {
              eventView.additionalConditions.setFilterValues('!transaction', [
                UNPARAMETERIZED_TRANSACTION,
              ]);
            }

            eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.
            eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.
            const mutableSearch = new MutableSearch(eventView.query);
            mutableSearch.removeFilter('transaction.duration');
            eventView.query = mutableSearch.formatString();
          } else if (
            props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES ||
            props.chartSetting === PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES
          ) {
            // Update request params
            eventView.dataset = DiscoverDatasets.SPANS_METRICS;
            extraQueryParams = {
              ...extraQueryParams,
              dataset: DiscoverDatasets.SPANS_METRICS,
              excludeOther: false,
              per_page: 50,
            };
            eventView.fields = [];

            // Update chart options
            partialDataParam = false;
            yAxis = `avg(${SpanMetricsField.SPAN_SELF_TIME})`;
            interval = getInterval(pageFilterDatetime, STARFISH_CHART_INTERVAL_FIDELITY);
            includePreviousParam = false;
            currentSeriesNames = [`avg(${SpanMetricsField.SPAN_SELF_TIME})`];

            // Update search query
            eventView.additionalConditions.removeFilter('event.type');
            eventView.additionalConditions.removeFilter('transaction');
            eventView.additionalConditions.addFilterValue(
              SpanMetricsField.SPAN_GROUP,
              provided.widgetData.list.data[selectedListIndex][
                SpanMetricsField.SPAN_GROUP
              ].toString()
            );
            const mutableSearch = new MutableSearch(eventView.query);
            mutableSearch.removeFilter('transaction');
            eventView.query = mutableSearch.formatString();
          } else {
            eventView.fields = [{field: 'transaction'}, {field}];
          }
          return (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              yAxis={yAxis}
              limit={1}
              includePrevious={includePreviousParam}
              includeTransformedData
              partial={partialDataParam}
              currentSeriesNames={currentSeriesNames}
              query={eventView.getQueryWithAdditionalConditions()}
              interval={interval}
              hideError
              onError={pageError.setPageError}
              queryExtras={extraQueryParams}
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

  const assembleAccordionItems = provided =>
    getItems(provided).map(item => ({header: item, content: getChart(provided)}));

  const getChart = provided =>
    function () {
      return (
        <DurationChart
          {...provided.widgetData.chart}
          {...provided}
          disableMultiAxis
          disableXAxis
          chartColors={props.chartColor ? [props.chartColor] : undefined}
          isLineChart
        />
      );
    };

  const getItems = provided =>
    provided.widgetData.list.data.map(
      listItem =>
        function () {
          const transaction = (listItem.transaction as string | undefined) ?? '';

          const additionalQuery: Record<string, string> = {};

          if (props.chartSetting === PerformanceWidgetSetting.SLOW_HTTP_OPS) {
            additionalQuery.breakdown = 'http';
            additionalQuery.display = 'latency';
          } else if (props.chartSetting === PerformanceWidgetSetting.SLOW_DB_OPS) {
            additionalQuery.breakdown = 'db';
            additionalQuery.display = 'latency';
          } else if (props.chartSetting === PerformanceWidgetSetting.SLOW_BROWSER_OPS) {
            additionalQuery.breakdown = 'browser';
            additionalQuery.display = 'latency';
          } else if (props.chartSetting === PerformanceWidgetSetting.SLOW_RESOURCE_OPS) {
            additionalQuery.breakdown = 'resource';
            additionalQuery.display = 'latency';
          }

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

          const fieldString = field;

          const valueMap = {
            [PerformanceWidgetSetting.MOST_RELATED_ERRORS]: listItem.failure_count,
            [PerformanceWidgetSetting.MOST_RELATED_ISSUES]: listItem.issue,
            slowest: getPerformanceDuration(listItem[fieldString] as number),
          };
          const rightValue =
            valueMap[isSlowestType ? 'slowest' : props.chartSetting] ??
            listItem[fieldString];

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
            case PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES:
            case PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES:
              const description: string = listItem[SpanMetricsField.SPAN_DESCRIPTION];
              const group: string = listItem[SpanMetricsField.SPAN_GROUP];
              const projectID: number = listItem['project.id'];
              const timeSpentPercentage: number = listItem[fieldString];
              const totalTime: number =
                listItem[`sum(${SpanMetricsField.SPAN_SELF_TIME})`];

              const isQueriesWidget =
                props.chartSetting ===
                PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES;
              const moduleName = isQueriesWidget ? ModuleName.DB : ModuleName.HTTP;
              const timeSpentOp = isQueriesWidget ? 'op' : undefined;
              const routingContextBaseURL = isQueriesWidget
                ? '/performance/database'
                : '/performance/browser/resources';
              return (
                <RoutingContextProvider value={{baseURL: routingContextBaseURL}}>
                  <Fragment>
                    <StyledTextOverflow>
                      <SpanDescriptionCell
                        projectId={projectID}
                        group={group}
                        description={description}
                        moduleName={moduleName}
                      />
                    </StyledTextOverflow>
                    <RightAlignedCell>
                      <TimeSpentCell
                        percentage={timeSpentPercentage}
                        total={totalTime}
                        op={timeSpentOp}
                      />
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
                </RoutingContextProvider>
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
        }
    );

  const Visualizations = organization.features.includes('performance-new-widget-designs')
    ? [
        {
          component: provided => (
            <Accordion
              expandedIndex={selectedListIndex}
              setExpandedIndex={setSelectListIndex}
              items={assembleAccordionItems(provided)}
            />
          ),
          // accordion items height + chart height
          height: TOTAL_EXPANDABLE_ROWS_HEIGHT + props.chartHeight,
          noPadding: true,
        },
      ]
    : [
        {
          component: provided => (
            <DurationChart
              {...provided.widgetData.chart}
              {...provided}
              disableMultiAxis
              disableXAxis
              chartColors={props.chartColor ? [props.chartColor] : undefined}
              isLineChart
            />
          ),
          height: props.chartHeight,
        },
        {
          component: provided => (
            <SelectableList
              selectedIndex={selectedListIndex}
              setSelectedIndex={setSelectListIndex}
              items={getItems(provided)}
            />
          ),
          height: 124,
          noPadding: true,
        },
      ];

  const getContainerActions = provided => {
    const route =
      props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES
        ? 'performance/database/'
        : 'performance/browser/resources/';
    return [
      PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES,
      PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES,
    ].includes(props.chartSetting) ? (
      <Fragment>
        <div>
          <LinkButton to={`/organizations/${organization.slug}/${route}`} size="sm">
            {t('View All')}
          </LinkButton>
        </div>
      </Fragment>
    ) : (
      ContainerActions && (
        <ContainerActions isLoading={provided.widgetData.list?.isLoading} />
      )
    );
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      location={location}
      Subtitle={() => (
        <Subtitle>{props.subTitle ?? t('Suggested transactions')}</Subtitle>
      )}
      HeaderActions={provided => getContainerActions(provided)}
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData.chart} />
          : null
      }
      EmptyComponent={emptyComponent}
      Queries={Queries}
      Visualizations={Visualizations}
    />
  );
}

const EventsRequest = withApi(_EventsRequest);

const StyledTextOverflow = styled(TextOverflow)`
  flex: 1;
`;
