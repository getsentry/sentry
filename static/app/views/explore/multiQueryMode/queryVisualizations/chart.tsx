import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import Feature from 'sentry/components/acl/feature';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconClock} from 'sentry/icons/iconClock';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {determineDefaultChartType} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useAddCompareQueryToDashboard} from 'sentry/views/explore/multiQueryMode/hooks/useAddCompareQueryToDashboard';
import {
  useUpdateQueryAtIndex,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {ConfidenceFooter} from 'sentry/views/explore/spans/charts/confidenceFooter';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

const CHART_HEIGHT = 260;
interface MultiQueryChartProps {
  index: number;
  mode: Mode;
  query: ReadableExploreQueryParts;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function MultiQueryModeChart({
  index,
  query: queryParts,
  mode,
  timeseriesResult,
}: MultiQueryChartProps) {
  const yAxes = queryParts.yAxes;
  const isTopN = mode === Mode.AGGREGATE;

  const [interval, setInterval, intervalOptions] = useChartInterval();

  const formattedYAxes = yAxes.map(yaxis => {
    const func = parseFunction(yaxis);
    return func ? prettifyParsedFunction(func) : undefined;
  });

  const updateChartType = useUpdateQueryAtIndex(index);

  const chartType = queryParts.chartType ?? determineDefaultChartType(yAxes);

  const visualizationType =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const chartInfo: ChartInfo = useMemo(() => {
    const series = yAxes.flatMap(yAxis => timeseriesResult.data[yAxis] ?? []);
    const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopN);

    return {
      chartType,
      confidence: combineConfidenceForSeries(series),
      series,
      timeseriesResult,
      yAxis: yAxes[0]!,
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode: undefined,
    };
  }, [chartType, isTopN, timeseriesResult, yAxes]);

  const organization = useOrganization();
  const {addToDashboard} = useAddCompareQueryToDashboard(queryParts);
  const pageFilters = usePageFilters();
  const {projects} = useProjects();

  const Title = (
    <Fragment>
      <Widget.WidgetTitle title={formattedYAxes.filter(Boolean).join(', ')} />
    </Fragment>
  );

  const items: MenuItemProps[] = [];

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

  if (defined(yAxes[0])) {
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
            trigger={triggerProps => (
              <OverlayTrigger.Button
                {...triggerProps}
                icon={<IconGraph type={visualizationType} />}
                borderless
                showChevron={false}
                size="xs"
              />
            )}
            value={chartType}
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
            trigger={triggerProps => (
              <OverlayTrigger.Button
                {...triggerProps}
                icon={<IconClock />}
                borderless
                showChevron={false}
                size="xs"
              />
            )}
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
      Visualization={<ChartVisualization chartInfo={chartInfo} />}
      Footer={
        <ConfidenceFooter
          sampleCount={chartInfo.sampleCount}
          isLoading={chartInfo.timeseriesResult?.isPending || false}
          isSampled={chartInfo.isSampled}
          confidence={chartInfo.confidence}
          topEvents={isTopN ? chartInfo.series.length : undefined}
          dataScanned={chartInfo.dataScanned}
        />
      }
    />
  );
}

const DisabledText = styled('span')`
  color: ${p => p.theme.tokens.content.disabled};
`;
