import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Accordion from 'sentry/components/accordion/accordion';
import {LinkButton} from 'sentry/components/button';
import EventsRequest, {RenderProps} from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Truncate from 'sentry/components/truncate';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatVersion} from 'sentry/utils/formatters';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {GenericPerformanceWidget} from 'sentry/views/performance/landing/widgets/components/performanceWidget';
import {
  GrowLink,
  WidgetEmptyStateWarning,
} from 'sentry/views/performance/landing/widgets/components/selectableList';
import {transformDiscoverToList} from 'sentry/views/performance/landing/widgets/transforms/transformDiscoverToList';
import {transformEventsRequestToArea} from 'sentry/views/performance/landing/widgets/transforms/transformEventsToArea';
import {
  PerformanceWidgetProps,
  QueryDefinition,
  QueryDefinitionWithKey,
  WidgetDataConstraint,
  WidgetDataResult,
  WidgetPropUnion,
} from 'sentry/views/performance/landing/widgets/types';
import {
  eventsRequestQueryProps,
  getMEPParamsIfApplicable,
  QUERY_LIMIT_PARAM,
  TOTAL_EXPANDABLE_ROWS_HEIGHT,
} from 'sentry/views/performance/landing/widgets/utils';
import {Subtitle} from 'sentry/views/profiling/landing/styles';
import {RightAlignedCell} from 'sentry/views/replays/deadRageClick/deadRageSelectorCards';
import Chart from 'sentry/views/starfish/components/chart';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {OUTPUT_TYPE, YAxis, YAXIS_COLUMNS} from 'sentry/views/starfish/views/screens';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

export function transformEventsChartRequest<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: RenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    widgetProps.location.query
  );

  const data = results.results ?? [];

  const childData = {
    ...results,
    isLoading: results.loading || results.reloading,
    isErrored: results.errored,
    hasData: defined(data) && !!data.length && !!data[0].data.length,
    data,
    previousData: results.previousTimeseriesData ?? undefined,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}

function SlowScreensByTTID(props: PerformanceWidgetProps) {
  const api = useApi();
  const pageFilter = usePageFilters();
  const mepSetting = useMEPSettingContext();
  const {
    isLoading: isLoadingReleases,
    primaryRelease,
    secondaryRelease,
  } = useReleaseSelection();
  const location = useLocation();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {organization, InteractiveTitle} = props;
  const pageError = usePageError();

  const field = props.fields[0];

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: field,
      component: provided => {
        if (isLoadingReleases) {
          return null;
        }

        const eventView = provided.eventView.clone();
        let extraQueryParams = getMEPParamsIfApplicable(mepSetting, props.chartSetting);

        // Set fields
        eventView.fields = [
          {field: 'transaction'},
          {field: YAXIS_COLUMNS[YAxis.TTID]},
          {field: 'count()'},
        ];
        eventView.sorts = [
          {
            field: 'count()',
            kind: 'desc',
          },
        ];

        // Change data set to metrics
        eventView.dataset = DiscoverDatasets.METRICS;
        extraQueryParams = {
          ...extraQueryParams,
          dataset: DiscoverDatasets.METRICS,
        };

        // Update query
        const mutableSearch = new MutableSearch(eventView.query);
        mutableSearch.addFilterValue('event.type', 'transaction');
        mutableSearch.addFilterValue('transaction.op', 'ui.load');
        eventView.query = appendReleaseFilters(
          mutableSearch,
          primaryRelease,
          secondaryRelease
        );

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
    [props.chartSetting, mepSetting.memoizationKey, primaryRelease, secondaryRelease]
  );

  const chartQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => {
      return {
        enabled: widgetData => {
          return !!widgetData?.list?.data?.length;
        },
        fields: field,
        component: provided => {
          if (selectedListIndex < 0) {
            return null;
          }

          const eventView = props.eventView.clone();
          let extraQueryParams = getMEPParamsIfApplicable(mepSetting, props.chartSetting);
          const pageFilterDatetime = {
            start: provided.start,
            end: provided.end,
            period: provided.period,
          };

          // Chart options
          const currentSeriesNames = [field];
          const includePreviousParam = false;
          const yAxis = provided.yAxis;
          const interval = getInterval(pageFilterDatetime, 'medium');
          const partialDataParam = true;

          eventView.additionalConditions.setFilterValues('transaction', [
            provided.widgetData.list.data[selectedListIndex].transaction as string,
          ]);

          eventView.dataset = DiscoverDatasets.METRICS;
          extraQueryParams = {
            ...extraQueryParams,
            dataset: DiscoverDatasets.METRICS,
          };

          eventView.fields = [
            {field: 'avg(measurements.time_to_initial_display)'},
            {field: 'release'},
          ];
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.addFilterValue('event.type', 'transaction');
          mutableSearch.addFilterValue('transaction.op', 'ui.load');
          eventView.query = appendReleaseFilters(
            mutableSearch,
            primaryRelease,
            secondaryRelease
          );
          eventView.interval = getInterval(
            pageFilter.selection.datetime,
            STARFISH_CHART_INTERVAL_FIDELITY
          );

          return (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              api={api}
              yAxis={yAxis}
              includePrevious={includePreviousParam}
              includeTransformedData
              partial={partialDataParam}
              currentSeriesNames={currentSeriesNames}
              field={eventView.getFields()}
              query={eventView.getQueryWithAdditionalConditions()}
              interval={interval}
              hideError
              onError={pageError.setPageError}
              queryExtras={extraQueryParams}
              topEvents={2}
              referrer="performance-line-chart-widget"
            />
          );
        },
        transform: transformEventsChartRequest,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.chartSetting,
      selectedListIndex,
      mepSetting.memoizationKey,
      primaryRelease,
      secondaryRelease,
    ]
  );

  const Queries = {
    list: listQuery,
    chart: chartQuery,
  };

  const assembleAccordionItems = provided =>
    getItems(provided).map(item => ({header: item, content: getChart(provided)}));

  const getChart = provided =>
    function () {
      const transformedReleaseSeries: {
        [releaseVersion: string]: Series;
      } = {};

      const series = provided.widgetData.chart.data;
      if (defined(series)) {
        series.forEach(({seriesName: release, data}) => {
          const isPrimary = release === primaryRelease;

          const label = release;
          const seriesData =
            data.map(datum => {
              return {
                name: datum.name,
                value: datum.value,
              } as SeriesDataUnit;
            }) ?? [];

          const color = isPrimary ? CHART_PALETTE[3][0] : CHART_PALETTE[3][1];
          transformedReleaseSeries[release] = {
            seriesName: formatVersion(label),
            color,
            data: seriesData,
          };
        });
      }

      return (
        <Chart
          height={props.chartHeight}
          data={Object.values(transformedReleaseSeries)}
          loading={provided.widgetData.chart.isLoading}
          grid={{
            left: '0',
            right: '0',
            top: '8px',
            bottom: '0',
          }}
          isLineChart
          aggregateOutputFormat={OUTPUT_TYPE[YAxis.TTID]}
          tooltipFormatterOptions={{
            valueFormatter: value =>
              tooltipFormatterUsingAggregateOutputType(value, OUTPUT_TYPE[YAxis.TTID]),
          }}
          errored={provided.widgetData.chart.isErrored}
          disableXAxis
          showLegend={false}
        />
      );
    };

  const getItems = provided =>
    provided.widgetData.list.data.map(
      listItem =>
        function () {
          const transaction = (listItem.transaction as string | undefined) ?? '';

          return (
            <Fragment>
              <GrowLink
                to={normalizeUrl({
                  pathname: `/performance/mobile/screens/spans/`,
                  query: {
                    project: listItem['project.id'],
                    transaction,
                    primaryRelease,
                    secondaryRelease,
                    ...normalizeDateTimeParams(location.query),
                  },
                })}
              >
                <Truncate value={transaction} maxLength={40} />
              </GrowLink>
              <RightAlignedCell>
                <StyledDurationWrapper>
                  <PerformanceDuration
                    milliseconds={listItem['avg(measurements.time_to_initial_display)']}
                    abbreviation
                  />
                </StyledDurationWrapper>
              </RightAlignedCell>
            </Fragment>
          );
        }
    );

  const Visualizations = [
    {
      component: provided =>
        isLoadingReleases || provided.widgetData.chart.loading ? (
          <LoadingIndicator />
        ) : (
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
  ];

  return (
    <GenericPerformanceWidget
      {...props}
      location={location}
      Subtitle={() => <Subtitle>{props.subTitle}</Subtitle>}
      HeaderActions={() => (
        <LinkButton
          to={normalizeUrl({
            pathname: `/organizations/${organization.slug}/performance/mobile/screens/`,
            query: {
              ...normalizeDateTimeParams(pageFilter),
              primaryRelease,
              secondaryRelease,
            },
          })}
          size="sm"
        >
          {t('View All')}
        </LinkButton>
      )}
      InteractiveTitle={
        InteractiveTitle ? () => <InteractiveTitle isLoading={false} /> : null
      }
      EmptyComponent={
        isLoadingReleases
          ? () => (
              <LoadingWrapper height={TOTAL_EXPANDABLE_ROWS_HEIGHT + props.chartHeight}>
                <StyledLoadingIndicator size={40} />
              </LoadingWrapper>
            )
          : WidgetEmptyStateWarning
      }
      Queries={Queries}
      Visualizations={Visualizations}
    />
  );
}

export default SlowScreensByTTID;

const StyledDurationWrapper = styled('div')`
  padding: 0 ${space(1)};
`;

const LoadingWrapper = styled('div')<{height?: number}>`
  height: ${p => p.height}px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
