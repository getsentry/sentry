import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import TextOverflow from 'sentry/components/textOverflow';
import Truncate from 'sentry/components/truncate';
import {t, tct} from 'sentry/locale';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import {getResourcesEventViewQuery} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {EXCLUDED_DB_OPS} from 'sentry/views/insights/database/settings';
import {DomainCell} from 'sentry/views/insights/http/components/tables/domainCell';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName, SpanFields, SpanFunction} from 'sentry/views/insights/types';
import DurationChart from 'sentry/views/performance/charts/chart';
import {excludeTransaction} from 'sentry/views/performance/landing/utils';
import {Accordion} from 'sentry/views/performance/landing/widgets/components/accordion';
import {GenericPerformanceWidget} from 'sentry/views/performance/landing/widgets/components/performanceWidget';
import SelectableList, {
  GrowLink,
  HighestCacheMissRateTransactionsWidgetEmptyStateWarning,
  ListClose,
  RightAlignedCell,
  Subtitle,
  TimeConsumingDomainsWidgetEmptyStateWarning,
  TimeSpentInDatabaseWidgetEmptyStateWarning,
  WidgetAddInstrumentationWarning,
  WidgetEmptyStateWarning,
} from 'sentry/views/performance/landing/widgets/components/selectableList';
import {transformDiscoverToList} from 'sentry/views/performance/landing/widgets/transforms/transformDiscoverToList';
import {transformEventsRequestToArea} from 'sentry/views/performance/landing/widgets/transforms/transformEventsToArea';
import type {
  GenericPerformanceWidgetProps,
  PerformanceWidgetProps,
  QueryDefinition,
  WidgetDataResult,
} from 'sentry/views/performance/landing/widgets/types';
import {
  eventsRequestQueryProps,
  getMEPParamsIfApplicable,
  QUERY_LIMIT_PARAM,
  TOTAL_EXPANDABLE_ROWS_HEIGHT,
} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {EAP_QUERY_PARAMS} from 'sentry/views/performance/landing/widgets/widgets/settings';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

type ComponentData = React.ComponentProps<
  GenericPerformanceWidgetProps<DataType>['Visualizations'][0]['component']
>;

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
  const {setPageDanger} = usePageAlert();
  const canHaveIntegrationEmptyState = integrationEmptyStateWidgets.includes(
    props.chartSetting
  );
  const useEap = useInsightsEap();
  const canUseMetrics = canUseMetricsData(organization);

  // Some am1 customers have on demand metrics, so we still need to keep metrics here.
  let metricsDataset = canUseMetrics
    ? DiscoverDatasets.METRICS
    : DiscoverDatasets.TRANSACTIONS;

  const spanDataset = DiscoverDatasets.SPANS;

  if (useEap) {
    metricsDataset = DiscoverDatasets.SPANS;
  }

  const spanQueryParams: Record<string, string> = {...EAP_QUERY_PARAMS};

  const metricsQueryParams: Record<string, string> = useEap
    ? {...EAP_QUERY_PARAMS}
    : {dataset: metricsDataset};

  let emptyComponent: any;
  if (props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES) {
    emptyComponent = TimeSpentInDatabaseWidgetEmptyStateWarning;
  } else if (
    props.chartSetting === PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS
  ) {
    emptyComponent = TimeConsumingDomainsWidgetEmptyStateWarning;
  } else if (
    props.chartSetting === PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS
  ) {
    emptyComponent = HighestCacheMissRateTransactionsWidgetEmptyStateWarning;
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

  const field = props.fields[0]!;

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
          if (canUseMetrics) {
            eventView.additionalConditions.setFilterValues('!transaction', [
              UNPARAMETERIZED_TRANSACTION,
            ]);
          }
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('transaction.duration');
          removeTransactionOpFilter({eventView, mutableSearch, useEap});
          eventView.query = mutableSearch.formatString();
        } else if (
          props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES
        ) {
          // Set fields
          eventView.fields = [
            {field: SpanFields.SPAN_OP},
            {field: SpanFields.SPAN_GROUP},
            {field: 'project.id'},
            {field: SpanFields.NORMALIZED_DESCRIPTION},
            {field: `sum(${SpanFields.SPAN_SELF_TIME})`},
            {field: `avg(${SpanFields.SPAN_SELF_TIME})`},
            {field},
          ];

          // Change data set to spans
          eventView.dataset = spanDataset;
          extraQueryParams = {
            ...extraQueryParams,
            ...spanQueryParams,
          };

          // Update query
          const mutableSearch = new MutableSearch(eventView.query);

          removeTransactionFilterForSpanQuery({eventView, mutableSearch, useEap});
          eventView.additionalConditions.removeFilter('time_spent_percentage()');
          mutableSearch.addFilterValue('has', 'sentry.normalized_description');
          mutableSearch.addFilterValue('span.category', 'db');
          mutableSearch.addFilterValue('!span.op', `[${EXCLUDED_DB_OPS.join(',')}]`);
          eventView.query = mutableSearch.formatString();
        } else if (
          props.chartSetting === PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS
        ) {
          // Set fields
          eventView.fields = [
            {field: SpanFields.PROJECT_ID},
            {field: SpanFields.SPAN_DOMAIN},
            {field: `sum(${SpanFields.SPAN_SELF_TIME})`},
            {field: `avg(${SpanFields.SPAN_SELF_TIME})`},
            {field},
          ];

          // Change data set to spans
          eventView.dataset = spanDataset;
          extraQueryParams = {
            ...extraQueryParams,
            ...spanQueryParams,
          };

          // Update query
          const mutableSearch = new MutableSearch(eventView.query);
          removeTransactionFilterForSpanQuery({eventView, mutableSearch, useEap});
          removeTransactionOpFilter({eventView, mutableSearch, useEap});
          eventView.additionalConditions.removeFilter('time_spent_percentage()');
          mutableSearch.addFilterValue('span.category', 'http');
          eventView.query = mutableSearch.formatString();
        } else if (
          props.chartSetting === PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES
        ) {
          // Set fields
          eventView.fields = [
            {field: SpanFields.NORMALIZED_DESCRIPTION},
            {field: SpanFields.SPAN_OP},
            {field: 'project.id'},
            {field: SpanFields.SPAN_GROUP},
            {field: `sum(${SpanFields.SPAN_SELF_TIME})`},
            {field: `avg(${SpanFields.SPAN_SELF_TIME})`},
            {field},
          ];

          // Change data set to spans
          eventView.dataset = spanDataset;
          extraQueryParams = {
            ...extraQueryParams,
            ...spanQueryParams,
          };

          // Update query
          const mutableSearch = new MutableSearch(eventView.query);
          removeTransactionFilterForSpanQuery({eventView, mutableSearch, useEap});
          mutableSearch.removeFilter('time_spent_percentage()');
          eventView.additionalConditions.removeFilter('time_spent_percentage()');
          eventView.query = `${mutableSearch.formatString()} ${getResourcesEventViewQuery(
            {'resource.render_blocking_status': 'blocking'},
            DEFAULT_RESOURCE_TYPES
          ).join(' ')}`;
        } else if (
          props.chartSetting ===
          PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS
        ) {
          eventView.fields = [
            {field: SpanFields.TRANSACTION},
            {field: 'project.id'},
            {field},
          ];

          // Change data set to spans
          eventView.dataset = spanDataset;
          extraQueryParams = {
            ...extraQueryParams,
            ...spanQueryParams,
          };

          // Update query
          const mutableSearch = MutableSearch.fromQueryObject(BASE_FILTERS);
          removeTransactionFilterForSpanQuery({eventView, mutableSearch, useEap});
          removeTransactionOpFilter({eventView, mutableSearch, useEap});
          eventView.query = mutableSearch.formatString();
        } else if (isSlowestType || isFramesType) {
          eventView.additionalConditions.setFilterValues('count()', ['>1']);
          extraQueryParams = {
            ...extraQueryParams,
            ...metricsQueryParams,
          };
          eventView.dataset = metricsDataset;
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
            PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS,
            PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS,
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

  const {view} = useDomainViewFilters();

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => {
      return {
        enabled: widgetData => {
          return !!widgetData?.list?.data?.length;
        },
        fields: field,
        component: provided => {
          const eventView = props.eventView.clone();
          let extraQueryParams: Record<string, string | boolean | number> =
            getMEPParamsIfApplicable(mepSetting, props.chartSetting)!;
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
            !provided.widgetData.list.data[selectedListIndex]?.transaction &&
            !provided.widgetData.list.data[selectedListIndex]?.[
              SpanFields.NORMALIZED_DESCRIPTION
            ] &&
            !provided.widgetData.list.data[selectedListIndex]?.[SpanFields.SPAN_DOMAIN]
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

            if (canUseMetrics) {
              eventView.additionalConditions.setFilterValues('!transaction', [
                UNPARAMETERIZED_TRANSACTION,
              ]);
            }

            if (useEap) {
              eventView.additionalConditions.removeFilter('span.op');
              eventView.additionalConditions.removeFilter('!span.op');
            } else {
              eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.
              eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.
            }
            const mutableSearch = new MutableSearch(eventView.query);
            mutableSearch.removeFilter('transaction.duration');
            eventView.query = mutableSearch.formatString();
          } else if (
            props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES ||
            props.chartSetting ===
              PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES ||
            props.chartSetting === PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS
          ) {
            // Update request params
            eventView.dataset = spanDataset;
            extraQueryParams = {
              ...extraQueryParams,
              ...spanQueryParams,
              excludeOther: false,
              per_page: 50,
            };
            eventView.fields = [];

            // Update chart options
            partialDataParam = false;
            yAxis = `avg(${SpanFields.SPAN_SELF_TIME})`;
            interval = getInterval(pageFilterDatetime, STARFISH_CHART_INTERVAL_FIDELITY);
            includePreviousParam = false;
            currentSeriesNames = [`avg(${SpanFields.SPAN_SELF_TIME})`];

            // Update search query
            removeTransactionFilterForSpanQuery({eventView, useEap});
            eventView.additionalConditions.removeFilter('transaction');

            if (
              props.chartSetting === PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS
            ) {
              eventView.additionalConditions.addFilterValue(
                SpanFields.SPAN_DOMAIN,
                provided.widgetData.list.data[selectedListIndex][
                  SpanFields.SPAN_DOMAIN
                ]!.toString(),
                false
              );
            } else {
              eventView.additionalConditions.addFilterValue(
                SpanFields.SPAN_GROUP,
                provided.widgetData.list.data[selectedListIndex][
                  SpanFields.SPAN_GROUP
                ]!.toString()
              );
            }

            const mutableSearch = new MutableSearch(eventView.query);
            mutableSearch.removeFilter('transaction');
            eventView.query = mutableSearch.formatString();
          } else if (
            props.chartSetting ===
            PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS
          ) {
            // Update request params
            eventView.dataset = spanDataset;
            extraQueryParams = {
              ...extraQueryParams,
              ...spanQueryParams,
              excludeOther: false,
              per_page: 50,
            };
            eventView.fields = [];

            // Update chart options
            partialDataParam = false;
            yAxis = `${SpanFunction.CACHE_MISS_RATE}()`;
            interval = getInterval(pageFilterDatetime, STARFISH_CHART_INTERVAL_FIDELITY);
            includePreviousParam = false;
            currentSeriesNames = [`${SpanFunction.CACHE_MISS_RATE}()`];

            // Update search query
            removeTransactionFilterForSpanQuery({eventView, useEap});

            const mutableSearch = new MutableSearch(eventView.query);
            mutableSearch.removeFilter('transaction');
            eventView.query = mutableSearch.formatString();
          } else {
            eventView.fields = [{field: 'transaction'}, {field}];
          }

          if (useEap) {
            eventView.dataset = DiscoverDatasets.SPANS;
            extraQueryParams = {
              ...extraQueryParams,
              ...spanQueryParams,
            };
          }

          return (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              includeAllArgs={false}
              yAxis={yAxis}
              limit={1}
              includePrevious={includePreviousParam}
              includeTransformedData
              partial={partialDataParam}
              currentSeriesNames={currentSeriesNames}
              query={eventView.getQueryWithAdditionalConditions()}
              interval={interval}
              hideError
              onError={setPageDanger}
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

  const assembleAccordionItems = (provided: ComponentData) =>
    getItems(provided).map(item => ({header: item, content: getChart(provided)}));

  const getChart = (provided: ComponentData) => (
    <DurationChart
      {...provided.widgetData.chart}
      {...provided}
      disableMultiAxis
      disableXAxis
      chartColors={props.chartColor ? [props.chartColor] : undefined}
      isLineChart
    />
  );

  const getItems = (provided: ComponentData) =>
    provided.widgetData.list.data.map(listItem => {
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
            organization: props.organization,
            projectID: listItem['project.id'] as string,
            transaction,
            query: props.eventView.getPageFiltersQuery(),
            additionalQuery,
            view,
          });

      const fieldString = field;

      const valueMap = {
        [PerformanceWidgetSetting.MOST_RELATED_ERRORS]: listItem.failure_count,
        [PerformanceWidgetSetting.MOST_RELATED_ISSUES]: listItem.issue,
        slowest: getPerformanceDuration(listItem[fieldString] as number),
      };
      const rightValue =
        valueMap[
          isSlowestType ? 'slowest' : (props.chartSetting as keyof typeof valueMap)
        ] ?? listItem[fieldString];

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
                    excludeTransaction(listItem.transaction!, {
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
                  count: <Count value={rightValue!} />,
                })}
              </RightAlignedCell>
              {!props.withStaticFilters && (
                <ListClose
                  setSelectListIndex={setSelectListIndex}
                  onClick={() =>
                    excludeTransaction(listItem.transaction!, {
                      eventView: props.eventView,
                      location,
                    })
                  }
                />
              )}
            </Fragment>
          );
        case PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS:
          return (
            <Fragment>
              <StyledTextOverflow>
                <DomainCell
                  projectId={listItem[SpanFields.PROJECT_ID]!.toString()}
                  domain={listItem[SpanFields.SPAN_DOMAIN] as any}
                />
              </StyledTextOverflow>

              <RightAlignedCell>
                <TimeSpentCell
                  percentage={listItem[fieldString] as number}
                  total={listItem[`sum(${SpanFields.SPAN_SELF_TIME})`] as number}
                  op="http.client"
                />
              </RightAlignedCell>

              {!props.withStaticFilters && (
                <ListClose
                  setSelectListIndex={setSelectListIndex}
                  onClick={() =>
                    excludeTransaction(listItem.transaction!, {
                      eventView: props.eventView,
                      location,
                    })
                  }
                />
              )}
            </Fragment>
          );
        case PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES:
        case PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES: {
          const description = listItem[SpanFields.NORMALIZED_DESCRIPTION] as string;
          const group = listItem[SpanFields.SPAN_GROUP] as string;
          const projectID = listItem['project.id'] as number;
          const timeSpentPercentage = listItem[fieldString] as number;
          const totalTime = listItem[`sum(${SpanFields.SPAN_SELF_TIME})`] as number;

          const isQueriesWidget =
            props.chartSetting === PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES;
          const moduleName = isQueriesWidget ? ModuleName.DB : ModuleName.RESOURCE;
          const timeSpentOp = isQueriesWidget ? 'op' : undefined;

          return (
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
                    excludeTransaction(listItem.transaction!, {
                      eventView: props.eventView,
                      location,
                    })
                  }
                />
              )}
            </Fragment>
          );
        }
        case PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS: {
          const moduleRoute = moduleURLBuilder('cache', 'backend');
          const cacheMissRate = listItem[fieldString] as any;

          const target = normalizeUrl(
            `${moduleRoute}/?${qs.stringify({transaction, project: listItem['project.id']})}`
          );

          return (
            <Fragment>
              <GrowLink to={target}>
                <Truncate value={transaction} maxLength={40} />
              </GrowLink>
              <RightAlignedCell>{formatPercentage(cacheMissRate)}</RightAlignedCell>
              {!props.withStaticFilters && (
                <ListClose
                  setSelectListIndex={setSelectListIndex}
                  onClick={() =>
                    excludeTransaction(listItem.transaction!, {
                      eventView: props.eventView,
                      location,
                    })
                  }
                />
              )}
            </Fragment>
          );
        }
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
                      excludeTransaction(listItem.transaction!, {
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
                    excludeTransaction(listItem.transaction!, {
                      eventView: props.eventView,
                      location,
                    })
                  }
                />
              )}
            </Fragment>
          );
      }
    });

  const Visualizations: GenericPerformanceWidgetProps<DataType>['Visualizations'] =
    organization.features.includes('performance-new-widget-designs')
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

  const moduleURLBuilder = useModuleURLBuilder();

  const getContainerActions = (provided: ComponentData) => {
    const route: string =
      (
        {
          [PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES]: moduleURLBuilder('db'),
          [PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES]:
            moduleURLBuilder('resource'),
          [PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS]:
            moduleURLBuilder('http'),
          [PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS]:
            moduleURLBuilder('cache'),
        } as any
      )[props.chartSetting] ?? '';

    return [
      PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES,
      PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES,
      PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS,
      PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS,
    ].includes(props.chartSetting) ? (
      <Fragment>
        <div>
          <LinkButton to={`${route}/`} size="sm">
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
        <Subtitle>{props.subTitle ?? t('Found in the following transactions')}</Subtitle>
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

const removeTransactionFilterForSpanQuery = ({
  eventView,
  mutableSearch,
  useEap,
}: {
  eventView: EventView;
  useEap: boolean;
  mutableSearch?: MutableSearch;
}) => {
  if (useEap) {
    eventView.additionalConditions.removeFilter('is_transaction');
    mutableSearch?.removeFilter('is_transaction');
  } else {
    eventView.additionalConditions.removeFilter('event.type');
    mutableSearch?.removeFilter('event.type');
  }
};

const removeTransactionOpFilter = ({
  eventView,
  mutableSearch,
  useEap,
}: {
  eventView: EventView;
  useEap: boolean;
  mutableSearch?: MutableSearch;
}) => {
  if (useEap) {
    eventView.additionalConditions.removeFilter('span.op');
    eventView.additionalConditions.removeFilter('!span.op');
    mutableSearch?.removeFilter('span.op');
    mutableSearch?.removeFilter('!span.op');
  } else {
    eventView.additionalConditions.removeFilter('transaction.op');
    eventView.additionalConditions.removeFilter('!transaction.op');
    mutableSearch?.removeFilter('transaction.op');
    mutableSearch?.removeFilter('!transaction.op');
  }
};
