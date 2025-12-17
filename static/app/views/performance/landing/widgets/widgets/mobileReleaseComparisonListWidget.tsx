import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import type {RenderProps} from 'sentry/components/charts/eventsRequest';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import type {TabKey} from 'sentry/views/insights/mobile/screens/views/screenDetailsPage';
import {ModuleName} from 'sentry/views/insights/types';
import {Accordion} from 'sentry/views/performance/landing/widgets/components/accordion';
import {GenericPerformanceWidget} from 'sentry/views/performance/landing/widgets/components/performanceWidget';
import {
  GrowLink,
  WidgetEmptyStateWarning,
} from 'sentry/views/performance/landing/widgets/components/selectableList';
import {transformDiscoverToList} from 'sentry/views/performance/landing/widgets/transforms/transformDiscoverToList';
import type {transformEventsRequestToArea} from 'sentry/views/performance/landing/widgets/transforms/transformEventsToArea';
import type {
  GenericPerformanceWidgetProps,
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
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {EAP_QUERY_PARAMS} from 'sentry/views/performance/landing/widgets/widgets/settings';
import {Subtitle} from 'sentry/views/profiling/landing/styles';
import {RightAlignedCell} from 'sentry/views/replays/selectors/deadRageSelectorCards';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

type ComponentData = React.ComponentProps<
  GenericPerformanceWidgetProps<DataType>['Visualizations'][0]['component']
>;

function transformEventsChartRequest<T extends WidgetDataConstraint>(
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
    hasData: defined(data) && !!data.length && !!data[0]!.data.length,
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

function MobileReleaseComparisonListWidget(props: PerformanceWidgetProps) {
  const api = useApi();
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const mepSetting = useMEPSettingContext();
  const {isLoading: isLoadingReleases, primaryRelease} = useReleaseSelection();
  const location = useLocation();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {InteractiveTitle} = props;
  const {setPageError} = usePageAlert();
  const dataset = DiscoverDatasets.SPANS;

  const queryParams: Record<string, string> = {...EAP_QUERY_PARAMS};
  const segmentOp = 'span.op';

  const field = props.fields[0]!;

  const listQuery = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: field,
      component: provided => {
        if (isLoadingReleases || !primaryRelease) {
          return null;
        }

        const eventView = provided.eventView.clone();
        let extraQueryParams = queryParams;

        // Set fields
        const sortField: string = (
          {
            [PerformanceWidgetSetting.SLOW_SCREENS_BY_TTID]: 'count()',
            [PerformanceWidgetSetting.SLOW_SCREENS_BY_COLD_START]:
              'count_starts(measurements.app_start_cold)',
            [PerformanceWidgetSetting.SLOW_SCREENS_BY_WARM_START]:
              'count_starts(measurements.app_start_warm)',
          } as any
        )[props.chartSetting];
        eventView.fields = [{field: 'transaction'}, {field}, {field: sortField}];
        eventView.sorts = [
          {
            field: sortField,
            kind: 'desc',
          },
        ];

        // Change data set to metrics
        eventView.dataset = dataset;
        extraQueryParams = {
          ...extraQueryParams,
          ...queryParams,
        };

        // Update query
        const mutableSearch = new MutableSearch(eventView.query);
        mutableSearch.addFilterValue(segmentOp, 'ui.load');
        eventView.query = appendReleaseFilters(mutableSearch, primaryRelease);

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
    [props.chartSetting, mepSetting.memoizationKey, primaryRelease]
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
            provided.widgetData.list.data[selectedListIndex]!.transaction as string,
          ]);

          eventView.dataset = dataset;
          extraQueryParams = {
            ...extraQueryParams,
            ...queryParams,
          };

          eventView.fields = [{field}, {field: 'release'}];
          const mutableSearch = new MutableSearch(eventView.query);
          mutableSearch.addFilterValue(segmentOp, 'ui.load');
          eventView.query = appendReleaseFilters(mutableSearch, primaryRelease);
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
              onError={setPageError}
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
    [props.chartSetting, selectedListIndex, mepSetting.memoizationKey, primaryRelease]
  );

  const Queries = {
    list: listQuery,
    chart: chartQuery,
  };

  const assembleAccordionItems = (provided: ComponentData) =>
    getItems(provided).map(item => ({header: item, content: getChart(provided)}));

  const getChart = (provided: ComponentData) => {
    const transformedReleaseSeries: Record<string, Series> = {};

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

        const colors = theme.chart.getColorPalette(3);
        const color = isPrimary ? colors[0] : colors[1];
        transformedReleaseSeries[release] = {
          seriesName: formatVersion(label, true),
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
        type={ChartType.LINE}
        aggregateOutputFormat="duration"
        tooltipFormatterOptions={{
          valueFormatter: value =>
            tooltipFormatterUsingAggregateOutputType(value, 'duration'),
        }}
        // @ts-expect-error TS(2339): Property 'error' does not exist on type 'WidgetDat... Remove this comment to see the full error message
        error={provided.widgetData.chart.error}
        disableXAxis
        showLegend={false}
      />
    );
  };

  const moduleURLBuilder = useModuleURLBuilder();

  const isAppStartup = [
    PerformanceWidgetSetting.SLOW_SCREENS_BY_COLD_START,
    PerformanceWidgetSetting.SLOW_SCREENS_BY_WARM_START,
  ].includes(props.chartSetting);
  const targetModulePath = moduleURLBuilder(ModuleName.MOBILE_VITALS);
  const targetQueryParams = isAppStartup
    ? {
        tab: 'app_start' satisfies TabKey,
        app_start_type:
          props.chartSetting === PerformanceWidgetSetting.SLOW_SCREENS_BY_COLD_START
            ? 'cold'
            : 'warm',
      }
    : {tab: 'screen_load' satisfies TabKey};
  const getItems = (provided: ComponentData) =>
    provided.widgetData.list.data.map((listItem, i) => {
      const transaction = (listItem.transaction as string | undefined) ?? '';

      return (
        <Fragment key={i}>
          <GrowLink
            to={{
              pathname: `${targetModulePath}/details/`,
              query: {
                project: listItem['project.id'],
                transaction,
                primaryRelease,
                ...normalizeDateTimeParams(location.query),
                ...targetQueryParams,
              },
            }}
          >
            <Truncate value={transaction} maxLength={40} />
          </GrowLink>
          <RightAlignedCell>
            <StyledDurationWrapper>
              {/* milliseconds expects a number */}
              <PerformanceDuration milliseconds={listItem[field] as any} abbreviation />
            </StyledDurationWrapper>
          </RightAlignedCell>
        </Fragment>
      );
    });

  const Visualizations: GenericPerformanceWidgetProps<DataType>['Visualizations'] = [
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
            pathname: targetModulePath,
            query: {
              ...normalizeDateTimeParams(pageFilter),
              ...targetQueryParams,
              primaryRelease,
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

export default MobileReleaseComparisonListWidget;

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
