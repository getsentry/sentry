import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Accordion from 'sentry/components/accordion/accordion';
import {LinkButton} from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import StackedAreaChart from 'sentry/components/charts/stackedAreaChart';
import {getInterval} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import {Tooltip} from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {formatTimeSeriesResultsToChartData} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import {calculateOpportunity} from 'sentry/views/performance/browser/webVitals/utils/calculateOpportunity';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {WebVitalsScoreBreakdown} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsTimeseriesQuery';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';
import Chart from 'sentry/views/starfish/components/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {
  GrowLink,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToStackedArea} from '../transforms/transformEventsToStackedBars';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {
  eventsRequestQueryProps,
  getMEPParamsIfApplicable,
  QUERY_LIMIT_PARAM,
} from '../utils';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToStackedArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

export function StackedAreaChartListWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const mepSetting = useMEPSettingContext();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions, organization, InteractiveTitle, fields} = props;
  const pageError = usePageError();
  const theme = useTheme();
  const {data: projectData} = useProjectWebVitalsQuery();
  const colors = [...theme.charts.getColorPalette(5)].reverse();
  const field = fields[0];

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields,
      component: provided => {
        const eventView = provided.eventView.clone();
        let extraQueryParams = getMEPParamsIfApplicable(mepSetting, props.chartSetting);

        if (props.chartSetting === PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES) {
          // Set fields
          eventView.fields = [
            {field: 'transaction'},
            {field: 'transaction.op'},
            {field: 'project.id'},
            {field: 'p75(measurements.lcp)'},
            {field: 'p75(measurements.fcp)'},
            {field: 'p75(measurements.cls)'},
            {field: 'p75(measurements.ttfb)'},
            {field: 'p75(measurements.fid)'},
            {field},
          ];

          // Set Metrics
          eventView.dataset = DiscoverDatasets.METRICS;
          extraQueryParams = {
            ...extraQueryParams,
            dataset: DiscoverDatasets.METRICS,
          };

          eventView.sorts = [{kind: 'desc', field}];

          // Update query
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.removeFilter('event.type');
          eventView.additionalConditions.removeFilter('event.type');
          mutableSearch.addFilterValue('transaction.op', 'pageload');
          eventView.query = mutableSearch.formatString();
        } else {
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
        fields,
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
          let yAxis = provided.yAxis;
          const interval = getInterval(pageFilterDatetime, 'low');

          if (!provided.widgetData.list.data[selectedListIndex]?.transaction) {
            return null;
          }

          if (props.chartSetting === PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES) {
            // Update request params
            eventView.dataset = DiscoverDatasets.METRICS;
            extraQueryParams = {
              ...extraQueryParams,
              dataset: DiscoverDatasets.METRICS,
              excludeOther: false,
              per_page: 50,
            };
            eventView.fields = [];

            // Update chart options
            yAxis = [
              'p75(measurements.lcp)',
              'p75(measurements.fcp)',
              'p75(measurements.cls)',
              'p75(measurements.ttfb)',
              'p75(measurements.fid)',
              'count()',
            ];

            // Update search query
            eventView.additionalConditions.removeFilter('event.type');
            eventView.additionalConditions.addFilterValue('transaction.op', 'pageload');
            const mutableSearch = new MutableSearch(eventView.query);
            mutableSearch.addFilterValue(
              'transaction',
              provided.widgetData.list.data[selectedListIndex].transaction.toString()
            );
            eventView.query = mutableSearch.formatString();
          } else {
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
            currentSeriesNames = nonEmptySpanOpFields;
            yAxis = nonEmptySpanOpFields;
          }

          return (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              limit={5}
              yAxis={yAxis}
              includePrevious={false}
              includeTransformedData
              partial
              currentSeriesNames={currentSeriesNames}
              query={eventView.getQueryWithAdditionalConditions()}
              interval={interval}
              hideError
              onError={pageError.setPageError}
              queryExtras={extraQueryParams}
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

  const assembleAccordionItems = provided =>
    getHeaders(provided).map(header => ({header, content: getAreaChart(provided)}));

  const getAreaChart = provided =>
    function () {
      if (props.chartSetting === PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES) {
        const segmentColors = theme.charts.getColorPalette(3);

        const formattedWebVitalsScoreBreakdown: WebVitalsScoreBreakdown = {
          lcp: [],
          fcp: [],
          cls: [],
          ttfb: [],
          fid: [],
          total: [],
        };

        const getWebVitalValue = (webVital: WebVitals, rowIndex: number): number =>
          provided.widgetData.chart.data?.find(
            series => series.seriesName === `p75(measurements.${webVital})`
          ).data[rowIndex].value;

        provided.widgetData.chart.data
          ?.find(series => series.seriesName === 'p75(measurements.lcp)')
          ?.data.forEach((dataRow, index) => {
            const lcp: number = getWebVitalValue('lcp', index);
            const fcp: number = getWebVitalValue('fcp', index);
            const cls: number = getWebVitalValue('cls', index);
            const ttfb: number = getWebVitalValue('ttfb', index);
            const fid: number = getWebVitalValue('fid', index);

            // // This is kinda jank, but since events-stats zero fills, we need to assume that 0 values mean no data.
            // // 0 value for a webvital is low frequency, but not impossible. We may need to figure out a better way to handle this in the future.
            const {totalScore, lcpScore, fcpScore, fidScore, clsScore, ttfbScore} =
              calculatePerformanceScore({
                lcp: lcp === 0 ? Infinity : lcp,
                fcp: fcp === 0 ? Infinity : fcp,
                cls: cls === 0 ? Infinity : cls,
                ttfb: ttfb === 0 ? Infinity : ttfb,
                fid: fid === 0 ? Infinity : fid,
              });

            formattedWebVitalsScoreBreakdown.total.push({
              value: totalScore,
              name: dataRow.name,
            });
            formattedWebVitalsScoreBreakdown.cls.push({
              value: clsScore,
              name: dataRow.name,
            });
            formattedWebVitalsScoreBreakdown.lcp.push({
              value: lcpScore,
              name: dataRow.name,
            });
            formattedWebVitalsScoreBreakdown.fcp.push({
              value: fcpScore,
              name: dataRow.name,
            });
            formattedWebVitalsScoreBreakdown.ttfb.push({
              value: ttfbScore,
              name: dataRow.name,
            });
            formattedWebVitalsScoreBreakdown.fid.push({
              value: fidScore,
              name: dataRow.name,
            });
          });
        return (
          <Chart
            stacked
            height={150}
            data={formatTimeSeriesResultsToChartData(
              formattedWebVitalsScoreBreakdown,
              segmentColors
            )}
            disableXAxis
            loading={false}
            utc={false}
            grid={{
              left: 5,
              right: 5,
              top: 5,
              bottom: 0,
            }}
            dataMax={100}
            chartColors={segmentColors}
          />
        );
      }

      const durationUnit = getDurationUnit(provided.widgetData.chart.data);
      return (
        <StackedAreaChart
          {...provided.widgetData.chart}
          {...provided}
          colors={colors}
          series={provided.widgetData.chart.data}
          animation
          isGroupedByDate
          showTimeInTooltip
          yAxis={{
            minInterval: durationUnit,
            axisLabel: {
              formatter(value: number) {
                return axisLabelFormatter(
                  value,
                  aggregateOutputType(provided.widgetData.chart.data[0].seriesName),
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

  const getHeaders = provided =>
    provided.widgetData.list.data.map(
      listItem =>
        function () {
          const transaction = (listItem.transaction as string | undefined) ?? '';
          const count = projectData?.data[0]['count()'] as number;
          if (props.chartSetting === PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES) {
            const projectScore = calculatePerformanceScore({
              lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
              fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
              cls: projectData?.data[0]['p75(measurements.cls)'] as number,
              ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
              fid: projectData?.data[0]['p75(measurements.fid)'] as number,
            });
            const rowScore = calculatePerformanceScore({
              lcp: listItem['p75(measurements.lcp)'] as number,
              fcp: listItem['p75(measurements.fcp)'] as number,
              cls: listItem['p75(measurements.cls)'] as number,
              ttfb: listItem['p75(measurements.ttfb)'] as number,
              fid: listItem['p75(measurements.fid)'] as number,
            });
            const opportunity = calculateOpportunity(
              projectScore.totalScore,
              count,
              rowScore.totalScore,
              listItem['count()']
            );
            return (
              <Fragment>
                <GrowLink
                  to={{
                    pathname: '/performance/browser/pageloads/overview/',
                    query: {...location.query, transaction},
                  }}
                >
                  <Truncate value={transaction} maxLength={40} />
                </GrowLink>
                <StyledRightAlignedCell>
                  <Tooltip
                    title={t(
                      'The opportunity to improve your cumulative performance score.'
                    )}
                    isHoverable
                    showUnderline
                  >
                    <PerformanceBadge score={rowScore.totalScore} />
                  </Tooltip>
                  <Tooltip
                    title={t(
                      'The opportunity to improve your cumulative performance score.'
                    )}
                    isHoverable
                    showUnderline
                    skipWrapper
                  >
                    {opportunity}
                  </Tooltip>
                </StyledRightAlignedCell>
              </Fragment>
            );
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
                query: props.eventView.generateQueryStringObject(),
                subPath: 'spans',
              });

          const displayedField = 'count()';
          const rightValue = listItem[displayedField];

          return (
            <Fragment>
              <GrowLink to={transactionTarget}>
                <Truncate value={transaction} maxLength={40} />
              </GrowLink>
              <RightAlignedCell>
                <Count value={rightValue} />
              </RightAlignedCell>
            </Fragment>
          );
        }
    );

  const getContainerActions = provided => {
    return props.chartSetting === PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES ? (
      <Fragment>
        <div>
          <LinkButton
            to={`/organizations/${organization.slug}/performance/browser/pageloads/`}
            size="sm"
          >
            {t('View All')}
          </LinkButton>
        </div>
        {ContainerActions && (
          <ContainerActions isLoading={provided.widgetData.list?.isLoading} />
        )}
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
        <Subtitle>{props.subTitle ?? t('P75 in Top Transactions')}</Subtitle>
      )}
      HeaderActions={provided => getContainerActions(provided)}
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

const StyledRightAlignedCell = styled(RightAlignedCell)`
  justify-content: space-between;
  width: 115px;
`;
const EventsRequest = withApi(_EventsRequest);
