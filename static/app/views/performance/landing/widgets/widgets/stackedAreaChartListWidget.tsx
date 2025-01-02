import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import pick from 'lodash/pick';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import StackedAreaChart from 'sentry/components/charts/stackedAreaChart';
import {getInterval} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';

import {Accordion} from '../components/accordion';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import {
  GrowLink,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToStackedArea} from '../transforms/transformEventsToStackedBars';
import type {
  GenericPerformanceWidgetProps,
  PerformanceWidgetProps,
  QueryDefinition,
  WidgetDataResult,
} from '../types';
import {
  eventsRequestQueryProps,
  getMEPParamsIfApplicable,
  QUERY_LIMIT_PARAM,
} from '../utils';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToStackedArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

type ComponentData = React.ComponentProps<
  GenericPerformanceWidgetProps<DataType>['Visualizations'][0]['component']
>;

export function StackedAreaChartListWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const mepSetting = useMEPSettingContext();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions, organization, InteractiveTitle, fields} = props;
  const {setPageError} = usePageAlert();
  const theme = useTheme();

  const colors = [...theme.charts.getColorPalette(5)].reverse();

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields,
      component: provided => {
        const eventView = provided.eventView.clone();

        eventView.fields = [
          {field: 'transaction'},
          {field: 'team_key_transaction'},
          {field: 'count()'},
          {field: 'project.id'},
          ...fields.map(f => ({field: f})),
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

        eventView.query = mutableSearch.formatString();

        // Don't retrieve list items with 0 in the field.
        eventView.additionalConditions.setFilterValues('count()', ['>0']);
        eventView.additionalConditions.setFilterValues('!transaction.op', ['']);
        return (
          <DiscoverQuery
            {...provided}
            eventView={eventView}
            location={location}
            limit={QUERY_LIMIT_PARAM}
            cursor="0:0:1"
            noPagination
            queryExtras={getMEPParamsIfApplicable(mepSetting, props.chartSetting)}
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

          // Skip character escaping because generating the query for EventsRequest
          // downstream will already handle escaping
          eventView.additionalConditions.setFilterValues(
            'transaction',
            [provided.widgetData.list.data[selectedListIndex].transaction as string],
            false
          );

          if (canUseMetricsData(organization)) {
            eventView.additionalConditions.setFilterValues('!transaction', [
              UNPARAMETERIZED_TRANSACTION,
            ]);
          }
          const listResult = provided.widgetData.list.data[selectedListIndex];
          const nonEmptySpanOpFields = Object.entries(listResult)
            .filter(result => fields.includes(result[0]) && result[1] !== 0)
            .map(result => result[0]);
          const prunedProvided = {...provided, yAxis: nonEmptySpanOpFields};

          return (
            <EventsRequest
              {...pick(prunedProvided, eventsRequestQueryProps)}
              limit={5}
              includePrevious={false}
              includeTransformedData
              partial
              currentSeriesNames={nonEmptySpanOpFields}
              query={eventView.getQueryWithAdditionalConditions()}
              interval={getInterval(
                {
                  start: prunedProvided.start,
                  end: prunedProvided.end,
                  period: prunedProvided.period,
                },
                'low'
              )}
              hideError
              onError={setPageError}
              queryExtras={getMEPParamsIfApplicable(mepSetting, props.chartSetting)}
            />
          );
        },
        transform: transformEventsRequestToStackedArea,
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
    getHeaders(provided).map(header => ({header, content: getAreaChart(provided)}));

  const getAreaChart = (provided: ComponentData) => {
    const durationUnit = getDurationUnit(provided.widgetData.chart.data ?? []);
    return (
      <StackedAreaChart
        {...provided.widgetData.chart}
        {...(provided as any)}
        colors={colors}
        series={provided.widgetData.chart.data ?? []}
        animation
        isGroupedByDate
        showTimeInTooltip
        yAxis={{
          minInterval: durationUnit,
          axisLabel: {
            formatter(value: number) {
              return axisLabelFormatter(
                value,
                aggregateOutputType(provided.widgetData.chart.data?.[0].seriesName),
                undefined,
                durationUnit
              );
            },
          },
        }}
        xAxis={{
          show: false,
          axisLabel: {show: true, margin: 8},
          axisLine: {show: false},
        }}
        tooltip={{
          valueFormatter: value => tooltipFormatter(value, 'duration'),
        }}
      />
    );
  };

  const getHeaders = (provided: ComponentData) =>
    provided.widgetData.list.data.map((listItem, i) => {
      const transaction = (listItem.transaction as string | undefined) ?? '';

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
            query: props.eventView.generateQueryStringObject(),
            subPath: 'spans',
          });

      const displayedField = 'count()';
      const rightValue = listItem[displayedField]!;

      return (
        <Fragment key={i}>
          <GrowLink to={transactionTarget}>
            <Truncate value={transaction} maxLength={40} />
          </GrowLink>
          <RightAlignedCell>
            <Count value={rightValue} />
          </RightAlignedCell>
        </Fragment>
      );
    });

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      location={location}
      Subtitle={() => <Subtitle>{t('P75 in Top Transactions')}</Subtitle>}
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
              items={assembleAccordionItems(provided)}
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
