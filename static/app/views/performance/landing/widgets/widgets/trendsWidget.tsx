import {Fragment, useMemo, useState} from 'react';
import {withRouter} from 'react-router';

import Button from 'sentry/components/button';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withProjects from 'sentry/utils/withProjects';
import {CompareDurations} from 'sentry/views/performance/trends/changedTransactions';
import {handleTrendsClick, trendsTargetRoute} from 'sentry/views/performance/utils';

import {Chart} from '../../../trends/chart';
import {TrendChangeType, TrendFunctionField} from '../../../trends/types';
import {excludeTransaction} from '../../utils';
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
  const {
    eventView: _eventView,
    ContainerActions,
    location,
    organization,
    noCellActions,
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
  eventView.additionalConditions.addFilterValues('count_percentage()', ['>0.25', '<4']);
  eventView.additionalConditions.addFilterValues('trend_percentage()', ['>0%']);
  eventView.additionalConditions.addFilterValues('confidence()', ['>6']);

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: ['transaction', 'project'],
      component: provided => (
        <TrendsDiscoverQuery
          {...provided}
          eventView={provided.eventView}
          location={props.location}
          trendChangeType={trendChangeType}
          trendFunctionField={trendFunctionField}
          limit={3}
          cursor="0:0:1"
          noPagination
        />
      ),
      transform: transformTrendsDiscover,
    }),
    [props.chartSetting, trendChangeType]
  );

  const Queries = {
    chart,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...rest}
      Subtitle={() => <Subtitle>{t('Trending Transactions')}</Subtitle>}
      HeaderActions={provided => {
        return (
          <Fragment>
            <div>
              <Button
                onClick={() => handleTrendsClick({location, organization})}
                size="small"
                data-test-id="view-all-button"
              >
                {t('View All')}
              </Button>
            </div>
            <ContainerActions {...provided.widgetData.chart} />
          </Fragment>
        );
      }}
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={Queries}
      Visualizations={[
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
              items={provided.widgetData.chart.transactionsList.map(listItem => () => {
                const initialConditions = new MutableSearch([]);
                initialConditions.addFilterValues('transaction', [listItem.transaction]);

                const trendsTarget = trendsTargetRoute({
                  organization: props.organization,
                  location: props.location,
                  initialConditions,
                  additionalQuery: {
                    trendFunction: trendFunctionField,
                  },
                });
                return (
                  <Fragment>
                    <GrowLink to={trendsTarget}>
                      <Truncate value={listItem.transaction} maxLength={40} />
                    </GrowLink>
                    <RightAlignedCell>
                      <CompareDurations transaction={listItem} />
                    </RightAlignedCell>
                    {!noCellActions && (
                      <ListClose
                        setSelectListIndex={setSelectListIndex}
                        onClick={() => excludeTransaction(listItem.transaction, props)}
                      />
                    )}
                  </Fragment>
                );
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

const TrendsChart = withRouter(withProjects(Chart));
