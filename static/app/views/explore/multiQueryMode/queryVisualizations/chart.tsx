import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {CompactSelect} from 'sentry/components/compactSelect';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock} from 'sentry/icons/iconClock';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {isTimeSeriesOther} from 'sentry/views/dashboards/widgets/timeSeriesWidget/isTimeSeriesOther';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/charts';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useAddCompareQueryToDashboard} from 'sentry/views/explore/multiQueryMode/hooks/useAddCompareQueryToDashboard';
import {DEFAULT_TOP_EVENTS} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTimeseries';
import {
  type ReadableExploreQueryParts,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {INGESTION_DELAY} from 'sentry/views/explore/settings';
import {combineConfidenceForSeries, showConfidence} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

const CHART_HEIGHT = 260;
export interface MultiQueryChartProps {
  canUsePreviousResults: boolean;
  index: number;
  mode: Mode;
  query: ReadableExploreQueryParts;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export const EXPLORE_CHART_GROUP = 'multi-query-charts_group';

export function MultiQueryModeChart({
  index,
  query: queryParts,
  mode,
  timeseriesResult,
  canUsePreviousResults,
}: MultiQueryChartProps) {
  const theme = useTheme();

  const yAxes = queryParts.yAxes;
  const isTopN = mode === Mode.AGGREGATE;

  const [confidence, numSeries] = useMemo(() => {
    const series = yAxes.flatMap(yAxis => timeseriesResult.data[yAxis]).filter(defined);
    return [
      combineConfidenceForSeries(series),
      Math.min(series.length, DEFAULT_TOP_EVENTS),
    ];
  }, [timeseriesResult.data, yAxes]);

  const [interval, setInterval, intervalOptions] = useChartInterval();

  const formattedYAxes = yAxes.map(yaxis => {
    const func = parseFunction(yaxis);
    return func ? prettifyParsedFunction(func) : undefined;
  });

  const updateChartType = useUpdateQueryAtIndex(index);

  const previousTimeseriesResult = usePrevious(timeseriesResult);

  const getSeries = useCallback(() => {
    const shouldUsePreviousResults =
      timeseriesResult.isPending &&
      canUsePreviousResults &&
      yAxes.every(yAxis => previousTimeseriesResult.data.hasOwnProperty(yAxis));

    const data = yAxes.flatMap((yAxis, i) => {
      const series = shouldUsePreviousResults
        ? previousTimeseriesResult.data[yAxis]
        : timeseriesResult.data[yAxis];
      return (series ?? []).map(s => {
        // We replace the series name with the formatted series name here
        // when possible as it's cleaner to read.
        //
        // We can't do this in top N mode as the series name uses the row
        // values instead of the aggregate function.
        if (s.field === yAxis) {
          return {
            ...s,
            seriesName: formattedYAxes[i] ?? yAxis,
          };
        }
        return s;
      });
    });
    return {
      data,
      error: shouldUsePreviousResults
        ? previousTimeseriesResult.error
        : timeseriesResult.error,
      loading: shouldUsePreviousResults
        ? previousTimeseriesResult.isPending
        : timeseriesResult.isPending,
    };
  }, [
    timeseriesResult.isPending,
    timeseriesResult.error,
    timeseriesResult.data,
    canUsePreviousResults,
    yAxes,
    previousTimeseriesResult.error,
    previousTimeseriesResult.isPending,
    previousTimeseriesResult.data,
    formattedYAxes,
  ]);

  const {data, error, loading} = getSeries();
  const {sampleCount, isSampled} = determineSeriesSampleCountAndIsSampled(data, isTopN);

  const visualizationType =
    queryParts.chartType === ChartType.LINE
      ? 'line'
      : queryParts.chartType === ChartType.AREA
        ? 'area'
        : 'bar';

  const chartInfo = {
    chartIcon: <IconGraph type={visualizationType} />,
    chartType: queryParts.chartType,
    yAxes,
    formattedYAxes,
    data,
    error,
    loading,
  };

  const organization = useOrganization();
  const {addToDashboard} = useAddCompareQueryToDashboard(queryParts);
  const pageFilters = usePageFilters();
  const {projects} = useProjects();

  const Title = (
    <Fragment>
      <Widget.WidgetTitle title={formattedYAxes.filter(Boolean).join(', ')} />
    </Fragment>
  );

  if (chartInfo.loading) {
    return (
      <Widget
        key={index}
        height={CHART_HEIGHT}
        Title={Title}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        revealActions="always"
      />
    );
  }
  if (chartInfo.error) {
    return (
      <Widget
        key={index}
        height={CHART_HEIGHT}
        Title={Title}
        Visualization={<Widget.WidgetError error={chartInfo.error} />}
        revealActions="always"
      />
    );
  }

  const items: MenuItemProps[] = [];

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

  if (organization.features.includes('alerts-eap') && defined(yAxes[0])) {
    items.push({
      key: 'create-alert',
      textValue: t('Create an Alert'),
      label: t('Create an Alert'),
      to: getAlertsUrl({
        project,
        query: queryParts.query,
        pageFilters: pageFilters.selection,
        aggregate: yAxes[0],
        organization,
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        interval,
      }),
      onAction: () => {
        trackAnalytics('trace_explorer.save_as', {
          save_type: 'alert',
          ui_source: 'compare chart',
          organization,
        });
      },
    });
  }

  if (organization.features.includes('dashboards-eap')) {
    const disableAddToDashboard = !organization.features.includes('dashboards-edit');
    items.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('Add to Dashboard')}</DisabledText>}
        >
          {t('Add to Dashboard')}
        </Feature>
      ),
      disabled: disableAddToDashboard,
      onAction: () => {
        if (disableAddToDashboard) {
          return undefined;
        }
        trackAnalytics('trace_explorer.save_as', {
          save_type: 'dashboard',
          ui_source: 'compare chart',
          organization,
        });
        return addToDashboard();
      },
    });
  }

  const DataPlottableConstructor =
    chartInfo.chartType === ChartType.LINE
      ? Line
      : chartInfo.chartType === ChartType.AREA
        ? Area
        : Bars;

  return (
    <Widget
      key={index}
      height={CHART_HEIGHT}
      Title={Title}
      Actions={[
        <Tooltip
          key="visualization"
          title={t('Type of chart displayed in this visualization (ex. line)')}
        >
          <CompactSelect
            triggerProps={{
              icon: chartInfo.chartIcon,
              borderless: true,
              showChevron: false,
              size: 'xs',
            }}
            value={chartInfo.chartType}
            menuTitle={t('Type')}
            options={EXPLORE_CHART_TYPE_OPTIONS}
            onChange={option => {
              updateChartType({chartType: option.value});
            }}
          />
        </Tooltip>,
        <Tooltip
          key="interval"
          title={t('Time interval displayed in this visualization (ex. 5m)')}
        >
          <CompactSelect
            value={interval}
            onChange={({value}) => setInterval(value)}
            triggerProps={{
              icon: <IconClock />,
              borderless: true,
              showChevron: false,
              size: 'xs',
            }}
            menuTitle="Interval"
            options={intervalOptions}
          />
        </Tooltip>,
        items && (
          <DropdownMenu
            key="contextMenu"
            triggerProps={{
              size: 'xs',
              borderless: true,
              showChevron: false,
              icon: <IconEllipsis />,
            }}
            position="bottom-end"
            items={items}
          />
        ),
      ]}
      revealActions="always"
      Visualization={
        <TimeSeriesWidgetVisualization
          plottables={chartInfo.data.map(timeSeries => {
            return new DataPlottableConstructor(timeSeries, {
              delay: INGESTION_DELAY,
              color: isTimeSeriesOther(timeSeries) ? theme.chartOther : undefined,
              stack: 'all',
            });
          })}
        />
      }
      Footer={
        showConfidence(isSampled) && (
          <ConfidenceFooter
            sampleCount={sampleCount}
            confidence={confidence}
            topEvents={isTopN ? numSeries : undefined}
          />
        )
      }
    />
  );
}

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;
