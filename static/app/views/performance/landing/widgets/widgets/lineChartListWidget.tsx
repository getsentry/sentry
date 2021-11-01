import {Fragment, FunctionComponent, useMemo, useState} from 'react';
import {withRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'app/components/charts/eventsRequest';
import {getInterval} from 'app/components/charts/utils';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import {IconClose} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import _DurationChart from 'app/views/performance/charts/chart';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import {getPerformanceDuration} from 'app/views/performance/utils';

import {excludeTransaction} from '../../utils';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {RightAlignedCell} from '../components/selectableList';
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {QueryDefinition, WidgetDataResult} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type Props = {
  title: string;
  titleTooltip: string;
  fields: string[];
  chartColor?: string;

  eventView: EventView;
  location: Location;
  organization: Organization;
  chartSetting: PerformanceWidgetSetting;

  ContainerActions: FunctionComponent<{isLoading: boolean}>;
};

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

export function LineChartListWidget(props: Props) {
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions} = props;

  if (props.fields.length !== 1) {
    throw new Error(
      `Line chart list widget can only accept a single field (${props.fields})`
    );
  }

  const slowList = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_DB_OPS,
    PerformanceWidgetSetting.SLOW_BROWSER_OPS,
    PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
    PerformanceWidgetSetting.MOST_SLOW_FRAMES,
    PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
  ];
  const isSlowestType = slowList.includes(props.chartSetting);

  const eventView = props.eventView.clone();

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: props.fields[0],
      component: provided => {
        eventView.sorts = [{kind: 'desc', field: props.fields[0]}];
        if (props.chartSetting === PerformanceWidgetSetting.MOST_RELATED_ISSUES) {
          eventView.fields = [
            {field: 'issue'},
            {field: 'transaction'},
            {field: 'title'},
            {field: 'project.id'},
            {field: props.fields[0]},
          ];
          eventView.additionalConditions.setFilterValues('event.type', ['error']);
          eventView.additionalConditions.setFilterValues('!tags[transaction]', ['']);
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('transaction.duration');
          eventView.query = mutableSearch.formatString();
        } else if (isSlowestType) {
          eventView.additionalConditions.setFilterValues('epm()', ['>0.01']);
          eventView.fields = [
            {field: 'transaction'},
            {field: 'project.id'},
            {field: 'epm()'},
            {field: props.fields[0]},
          ];
        } else {
          // Most related errors
          eventView.fields = [
            {field: 'transaction'},
            {field: 'project.id'},
            {field: props.fields[0]},
          ];
        }
        return (
          <DiscoverQuery
            {...provided}
            eventView={eventView}
            location={props.location}
            limit={3}
          />
        );
      },
      transform: transformDiscoverToList,
    }),
    [props.eventView.query, props.fields[0], props.organization.slug]
  );

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(() => {
    return {
      enabled: widgetData => {
        return !!widgetData?.list?.data?.length;
      },
      fields: props.fields[0],
      component: provided => {
        eventView.additionalConditions.setFilterValues('transaction', [
          provided.widgetData.list.data[selectedListIndex].transaction as string,
        ]);
        if (props.chartSetting === PerformanceWidgetSetting.MOST_RELATED_ISSUES) {
          eventView.fields = [
            {field: 'issue'},
            {field: 'issue.id'},
            {field: 'transaction'},
            {field: props.fields[0]},
          ];
          eventView.additionalConditions.setFilterValues('issue', [
            provided.widgetData.list.data[selectedListIndex].issue as string,
          ]);
          eventView.additionalConditions.setFilterValues('event.type', ['error']);
          eventView.additionalConditions.setFilterValues('!tags[transaction]', ['']);
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('transaction.duration');
          eventView.query = mutableSearch.formatString();
        } else {
          eventView.fields = [{field: 'transaction'}, {field: props.fields[0]}];
        }
        return (
          <EventsRequest
            {...provided}
            limit={1}
            includePrevious
            includeTransformedData
            partial
            currentSeriesNames={[props.fields[0]]}
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
  }, [
    props.eventView.query,
    props.fields[0],
    props.organization.slug,
    selectedListIndex,
  ]);

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
          height: 160,
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

                const fieldString = getAggregateAlias(props.fields[0]);

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
                        <CloseContainer>
                          <StyledIconClose
                            onClick={() =>
                              excludeTransaction(listItem.transaction, props)
                            }
                          />
                        </CloseContainer>
                      </Fragment>
                    );
                  default:
                    return (
                      <Fragment>
                        <GrowLink to={transactionTarget} className="truncate">
                          <Truncate value={transaction} maxLength={40} />
                        </GrowLink>
                        <RightAlignedCell>{rightValue}</RightAlignedCell>
                        <CloseContainer>
                          <StyledIconClose
                            onClick={() =>
                              excludeTransaction(listItem.transaction, props)
                            }
                          />
                        </CloseContainer>
                      </Fragment>
                    );
                }
              })}
            />
          ),
          height: 200,
          noPadding: true,
        },
      ]}
    />
  );
}

const EventsRequest = withApi(_EventsRequest);
const DurationChart = withRouter(_DurationChart);
const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;
const CloseContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: ${space(1)};
`;
const GrowLink = styled(Link)`
  flex-grow: 1;
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  color: ${p => p.theme.gray200};

  &:hover {
    color: ${p => p.theme.gray300};
  }
`;
