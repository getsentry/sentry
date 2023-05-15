import {Fragment, useMemo, useState} from 'react';

import {Button} from 'sentry/components/button';
import Truncate from 'sentry/components/truncate';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
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
import Accordion from '../components/accordion';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {
  GrowLink,
  ListClose,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformTrendsDiscover} from '../transforms/transformTrendsDiscover';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformTrendsDiscover>;
};

const fields = [{field: 'transaction'}, {field: 'project'}];

export function TrendsWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {projects} = useProjects();

  const {
    eventView: _eventView,
    ContainerActions,
    organization,
    withStaticFilters,
    InteractiveTitle,
  } = props;
  const trendChangeType =
    props.chartSetting === PerformanceWidgetSetting.MOST_IMPROVED
      ? TrendChangeType.IMPROVED
      : TrendChangeType.REGRESSION;
  const trendFunctionField = TrendFunctionField.AVG; // Average is the easiest chart to understand.

  const [selectedListIndex, setSelectListIndex] = useState<number>(0);

  const eventView = _eventView.clone();
  eventView.fields = fields;
  eventView.sorts = [
    {
      kind: trendChangeType === TrendChangeType.IMPROVED ? 'asc' : 'desc',
      field: 'trend_percentage()',
    },
  ];
  const rest = {...props, eventView};
  eventView.additionalConditions.addFilterValues('tpm()', ['>0.01']);
  if (!organization.features.includes('performance-new-trends')) {
    eventView.additionalConditions.addFilterValues('count_percentage()', ['>0.25', '<4']);
    eventView.additionalConditions.addFilterValues('trend_percentage()', ['>0%']);
    eventView.additionalConditions.addFilterValues('confidence()', ['>6']);
  }

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: ['transaction', 'project'],
      component: provided => (
        <TrendsDiscoverQuery
          {...provided}
          eventView={provided.eventView}
          location={location}
          trendChangeType={trendChangeType}
          trendFunctionField={trendFunctionField}
          limit={3}
          cursor="0:0:1"
          noPagination
          withBreakpoint={organization.features.includes('performance-new-trends')}
        />
      ),
      transform: transformTrendsDiscover,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, trendChangeType]
  );

  const assembleAccordionItems = provided =>
    getItems(provided).map(item => ({header: item, content: getChart(provided)}));

  const getChart = provided =>
    function () {
      return (
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
          transaction={provided.widgetData.chart.transactionsList[selectedListIndex]}
          trendChangeType={trendChangeType}
          trendFunctionField={trendFunctionField}
          disableXAxis
          disableLegend
        />
      );
    };

  const getItems = provided =>
    provided.widgetData.chart.transactionsList.map(
      listItem =>
        function () {
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
            <Fragment>
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
        }
    );

  const Queries = {
    chart,
  };

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
          height: 120 + props.chartHeight,
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
              transaction={provided.widgetData.chart.transactionsList[selectedListIndex]}
              trendChangeType={trendChangeType}
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

const TrendsChart = withProjects(Chart);
