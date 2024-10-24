import {Fragment, useMemo, useState} from 'react';

import {Button} from 'sentry/components/button';
import Truncate from 'sentry/components/truncate';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import withProjects from 'sentry/utils/withProjects';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import {CompareDurations} from 'sentry/views/performance/trends/changedTransactions';
import {
  getProjectID,
  getSelectedProjectPlatforms,
  handleTrendsClick,
  trendsTargetRoute,
} from 'sentry/views/performance/utils';

import {Chart} from '../../../trends/chart';
import {TrendChangeType, TrendFunctionField} from '../../../trends/types';
import {excludeTransaction} from '../../utils';
import {Accordion} from '../components/accordion';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {
  GrowLink,
  ListClose,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformTrendsDiscover} from '../transforms/transformTrendsDiscover';
import type {
  GenericPerformanceWidgetProps,
  PerformanceWidgetProps,
  QueryDefinition,
  WidgetDataResult,
} from '../types';
import {QUERY_LIMIT_PARAM, TOTAL_EXPANDABLE_ROWS_HEIGHT} from '../utils';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformTrendsDiscover>;
};

type ComponentData = React.ComponentProps<
  GenericPerformanceWidgetProps<DataType>['Visualizations'][0]['component']
>;

const fields = [{field: 'transaction'}, {field: 'project'}];

export function TrendsWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {projects} = useProjects();

  const {isLoading: isCardinalityCheckLoading, outcome} = useMetricsCardinalityContext();

  const {
    eventView: _eventView,
    ContainerActions,
    organization,
    withStaticFilters,
    InteractiveTitle,
  } = props;

  const withBreakpoint =
    organization.features.includes('performance-new-trends') &&
    !isCardinalityCheckLoading &&
    !outcome?.forceTransactionsOnly;

  const trendChangeType =
    props.chartSetting === PerformanceWidgetSetting.MOST_IMPROVED
      ? TrendChangeType.IMPROVED
      : TrendChangeType.REGRESSION;
  const derivedTrendChangeType = withBreakpoint ? TrendChangeType.ANY : trendChangeType;
  const trendFunctionField = TrendFunctionField.P95;

  const [selectedListIndex, setSelectListIndex] = useState<number>(0);

  const eventView = _eventView.clone();
  eventView.fields = fields;
  eventView.sorts = [
    {
      kind: derivedTrendChangeType === TrendChangeType.IMPROVED ? 'asc' : 'desc',
      field: 'trend_percentage()',
    },
  ];
  const rest = {...props, eventView};
  if (!withBreakpoint) {
    eventView.additionalConditions.addFilterValues('tpm()', ['>0.01']);
    eventView.additionalConditions.addFilterValues('count_percentage()', ['>0.25', '<4']);
    eventView.additionalConditions.addFilterValues('trend_percentage()', ['>0%']);
    eventView.additionalConditions.addFilterValues('confidence()', ['>6']);
  } else {
    eventView.additionalConditions.addFilterValues('tpm()', ['>0.1']);
  }

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: ['transaction', 'project'],
      component: provided => (
        <TrendsDiscoverQuery
          {...provided}
          eventView={provided.eventView}
          location={location}
          trendChangeType={derivedTrendChangeType}
          trendFunctionField={trendFunctionField}
          limit={QUERY_LIMIT_PARAM}
          cursor="0:0:1"
          noPagination
          withBreakpoint={withBreakpoint}
        />
      ),
      transform: transformTrendsDiscover,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, derivedTrendChangeType]
  );

  const assembleAccordionItems = (provided: ComponentData) =>
    getItems(provided).map(item => ({header: item, content: getChart(provided)}));

  const getChart = (provided: ComponentData) => (
    <TrendsChart
      {...provided}
      {...rest}
      isLoading={provided.widgetData.chart.isLoading || isCardinalityCheckLoading}
      statsData={provided.widgetData.chart.statsData}
      query={eventView.query}
      project={eventView.project}
      environment={eventView.environment}
      start={eventView.start}
      end={eventView.end}
      statsPeriod={eventView.statsPeriod}
      transaction={provided.widgetData.chart.transactionsList[selectedListIndex]}
      trendChangeType={derivedTrendChangeType}
      trendFunctionField={trendFunctionField}
      disableXAxis
      disableLegend
    />
  );

  const getItems = (provided: ComponentData) =>
    provided.widgetData.chart.transactionsList.map((listItem, i) => {
      const initialConditions = new MutableSearch([]);
      initialConditions.addFilterValues('transaction', [listItem.transaction]);

      const {statsPeriod, start, end} = eventView;

      const defaultPeriod = !start && !end ? DEFAULT_STATS_PERIOD : undefined;

      const trendsTarget = trendsTargetRoute({
        organization: props.organization,
        location,
        initialConditions,
        additionalQuery: {
          trendFunction: trendFunctionField,
          statsPeriod: statsPeriod || DEFAULT_STATS_PERIOD,
        },
      });

      const transactionTarget = transactionSummaryRouteWithQuery({
        orgSlug: props.organization.slug,
        projectID: getProjectID(listItem, projects),
        transaction: listItem.transaction,
        query: trendsTarget.query,
        additionalQuery: {
          display: DisplayModes.TREND,
          trendFunction: trendFunctionField,
          statsPeriod: statsPeriod || defaultPeriod,
          start,
          end,
        },
      });

      return (
        <Fragment key={i}>
          <GrowLink to={transactionTarget}>
            <Truncate value={listItem.transaction} maxLength={40} />
          </GrowLink>
          <RightAlignedCell>
            <CompareDurations transaction={listItem} />
          </RightAlignedCell>
          {!withStaticFilters && (
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
    });

  const Queries = {
    chart,
  };

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
              <TrendsChart
                {...provided}
                {...rest}
                isLoading={provided.widgetData.chart.isLoading}
                statsData={provided.widgetData.chart.statsData}
                query={eventView.query}
                project={eventView.project}
                environment={eventView.environment}
                start={eventView.start}
                end={eventView.end}
                statsPeriod={eventView.statsPeriod}
                transaction={
                  provided.widgetData.chart.transactionsList[selectedListIndex]
                }
                trendChangeType={derivedTrendChangeType}
                trendFunctionField={trendFunctionField}
                disableXAxis
                disableLegend
              />
            ),
            bottomPadding: false,
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

  return (
    <GenericPerformanceWidget<DataType>
      {...rest}
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData.chart} />
          : null
      }
      location={location}
      Subtitle={() => <Subtitle>{t('Trending Transactions')}</Subtitle>}
      HeaderActions={provided => {
        return (
          <Fragment>
            <div>
              <Button
                onClick={() =>
                  handleTrendsClick({
                    location,
                    organization,
                    projectPlatforms: getSelectedProjectPlatforms(location, projects),
                  })
                }
                size="sm"
                data-test-id="view-all-button"
              >
                {t('View All')}
              </Button>
            </div>
            {ContainerActions && <ContainerActions {...provided.widgetData.chart} />}
          </Fragment>
        );
      }}
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={Queries}
      Visualizations={Visualizations}
    />
  );
}

export const TrendsChart = withProjects(Chart);
