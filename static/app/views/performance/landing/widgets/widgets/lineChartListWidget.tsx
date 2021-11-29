import {Fragment, useMemo, useState} from 'react';
import {withRouter} from 'react-router';
import pick from 'lodash/pick';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {t, tct} from 'sentry/locale';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import _DurationChart from 'sentry/views/performance/charts/chart';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceDuration} from 'sentry/views/performance/utils';

import {excludeTransaction} from '../../utils';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {
  GrowLink,
  ListClose,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {eventsRequestQueryProps} from '../utils';
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
  PerformanceWidgetSetting.MOST_SLOW_FRAMES,
  PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
];

export function LineChartListWidget(props: PerformanceWidgetProps) {
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions} = props;

  if (props.fields.length !== 1) {
    throw new Error(
      `Line chart list widget can only accept a single field (${props.fields})`
    );
  }
  const field = props.fields[0];

  const isSlowestType = slowList.includes(props.chartSetting);

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: field,
      component: provided => {
        const eventView = provided.eventView.clone();
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
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('transaction.duration');
          eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.
          eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.
          eventView.query = mutableSearch.formatString();
        } else if (isSlowestType) {
          eventView.additionalConditions.setFilterValues('epm()', ['>0.01']);
          eventView.fields = [
            {field: 'transaction'},
            {field: 'project.id'},
            {field: 'epm()'},
            {field},
          ];
        } else {
          // Most related errors
          eventView.fields = [{field: 'transaction'}, {field: 'project.id'}, {field}];
        }
        // Don't retrieve list items with 0 in the field.
        eventView.additionalConditions.setFilterValues(field, ['>0']);
        return (
          <DiscoverQuery
            {...provided}
            eventView={eventView}
            location={props.location}
            limit={3}
            cursor="0:0:1"
            noPagination
          />
        );
      },
      transform: transformDiscoverToList,
    }),
    [props.chartSetting]
  );

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(() => {
    return {
      enabled: widgetData => {
        return !!widgetData?.list?.data?.length;
      },
      fields: field,
      component: provided => {
        const eventView = props.eventView.clone();
        if (!provided.widgetData.list.data[selectedListIndex]?.transaction) {
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
          eventView.additionalConditions.setFilterValues('!tags[transaction]', ['']);
          eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.
          eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('transaction.duration');
          eventView.query = mutableSearch.formatString();
        } else {
          eventView.fields = [{field: 'transaction'}, {field}];
        }
        return (
          <EventsRequest
            {...pick(provided, eventsRequestQueryProps)}
            limit={1}
            includePrevious
            includeTransformedData
            partial
            currentSeriesNames={[field]}
            query={eventView.getQueryWithAdditionalConditions()}
            interval={getInterval(
              {
                start: provided.start,
                end: provided.end,
                period: provided.period,
              },
              'medium'
            )}
          />
        );
      },
      transform: transformEventsRequestToArea,
    };
  }, [props.chartSetting, selectedListIndex]);

  const Queries = {
    list: listQuery,
    chart: chartQuery,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      Subtitle={() => <Subtitle>{t('Suggested transactions')}</Subtitle>}
      HeaderActions={provided => (
        <ContainerActions isLoading={provided.widgetData.list?.isLoading} />
      )}
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={Queries}
      Visualizations={[
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
              items={provided.widgetData.list.data.map(listItem => () => {
                const transaction = listItem.transaction as string;

                const additionalQuery: Record<string, string> = {};

                if (props.chartSetting === PerformanceWidgetSetting.SLOW_HTTP_OPS) {
                  additionalQuery.breakdown = 'http';
                  additionalQuery.display = 'latency';
                } else if (props.chartSetting === PerformanceWidgetSetting.SLOW_DB_OPS) {
                  additionalQuery.breakdown = 'db';
                  additionalQuery.display = 'latency';
                } else if (
                  props.chartSetting === PerformanceWidgetSetting.SLOW_BROWSER_OPS
                ) {
                  additionalQuery.breakdown = 'browser';
                  additionalQuery.display = 'latency';
                } else if (
                  props.chartSetting === PerformanceWidgetSetting.SLOW_RESOURCE_OPS
                ) {
                  additionalQuery.breakdown = 'resource';
                  additionalQuery.display = 'latency';
                }

                const transactionTarget = transactionSummaryRouteWithQuery({
                  orgSlug: props.organization.slug,
                  projectID: listItem['project.id'] as string,
                  transaction,
                  query: props.eventView.getGlobalSelectionQuery(),
                  additionalQuery,
                });

                const fieldString = getAggregateAlias(field);

                const valueMap = {
                  [PerformanceWidgetSetting.MOST_RELATED_ERRORS]: listItem.failure_count,
                  [PerformanceWidgetSetting.MOST_RELATED_ISSUES]: listItem.issue,
                  slowest: getPerformanceDuration(listItem[fieldString] as number),
                };
                const rightValue =
                  valueMap[isSlowestType ? 'slowest' : props.chartSetting];

                switch (props.chartSetting) {
                  case PerformanceWidgetSetting.MOST_RELATED_ISSUES:
                    return (
                      <Fragment>
                        <GrowLink to={transactionTarget} className="truncate">
                          <Truncate value={transaction} maxLength={40} />
                        </GrowLink>
                        <RightAlignedCell>
                          <Tooltip title={listItem.title}>
                            <Link
                              to={`/organizations/${props.organization.slug}/issues/${listItem['issue.id']}/`}
                            >
                              {rightValue}
                            </Link>
                          </Tooltip>
                        </RightAlignedCell>
                        <ListClose
                          setSelectListIndex={setSelectListIndex}
                          onClick={() => excludeTransaction(listItem.transaction, props)}
                        />
                      </Fragment>
                    );
                  case PerformanceWidgetSetting.MOST_RELATED_ERRORS:
                    return (
                      <Fragment>
                        <GrowLink to={transactionTarget} className="truncate">
                          <Truncate value={transaction} maxLength={40} />
                        </GrowLink>
                        <RightAlignedCell>
                          {tct('[count] errors', {
                            count: <Count value={rightValue} />,
                          })}
                        </RightAlignedCell>
                        <ListClose
                          setSelectListIndex={setSelectListIndex}
                          onClick={() => excludeTransaction(listItem.transaction, props)}
                        />
                      </Fragment>
                    );
                  default:
                    return (
                      <Fragment>
                        <GrowLink to={transactionTarget} className="truncate">
                          <Truncate value={transaction} maxLength={40} />
                        </GrowLink>
                        <RightAlignedCell>{rightValue}</RightAlignedCell>
                        <ListClose
                          setSelectListIndex={setSelectListIndex}
                          onClick={() => excludeTransaction(listItem.transaction, props)}
                        />
                      </Fragment>
                    );
                }
              })}
            />
          ),
          height: 124,
          noPadding: true,
        },
      ]}
    />
  );
}

const EventsRequest = withApi(_EventsRequest);
const DurationChart = withRouter(_DurationChart);
