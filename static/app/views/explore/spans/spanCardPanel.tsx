import {Activity, Fragment, useMemo, useRef} from 'react';
import type {DraggableAttributes} from '@dnd-kit/core';
import type {SyntheticListenerMap} from '@dnd-kit/core/dist/hooks/utilities';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Placeholder} from 'sentry/components/placeholder';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {parseError} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ChartIntervalUnspecifiedStrategy} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useCrossEventQueries} from 'sentry/views/explore/hooks/useCrossEventQueries';
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {
  type TracesTableResult,
  useExploreTracesTableApiOptions,
} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {type SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  useQueryParamsExtrapolate,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {ConfidenceFooter} from 'sentry/views/explore/spans/charts/confidenceFooter';
import {useCrossEventDatasetAvailability} from 'sentry/views/explore/spans/crossEvents/useCrossEventDatasetAvailability';
import type {SpanCard} from 'sentry/views/explore/spans/spanCardsQueryParams';
import {SpanCardQueryParamsProvider} from 'sentry/views/explore/spans/spanCardsQueryParams';
import {SpanCardToolbar} from 'sentry/views/explore/spans/spanCardToolbar';
import {useSpanCardInterval} from 'sentry/views/explore/spans/useSpanCardInterval';
import {ExploreTables} from 'sentry/views/explore/tables';
import {useRawCounts} from 'sentry/views/explore/useRawCounts';
import {
  combineConfidenceForSeries,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const RESULT_LIMIT = 50;
const SPAN_CARD_CHART_HEIGHT = 362;

const CHART_TYPE_TO_ICON: Record<ChartType, 'line' | 'area' | 'bar'> = {
  [ChartType.LINE]: 'line',
  [ChartType.AREA]: 'area',
  [ChartType.BAR]: 'bar',
  [ChartType.HEATMAP]: 'line',
};

interface SpanCardPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  card: SpanCard;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  isAnyDragging?: boolean;
  isDragging?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export function SpanCardPanel({
  card,
  dragAttributes,
  dragListeners,
  isAnyDragging,
  isDragging,
  ref,
  style,
  ...rest
}: SpanCardPanelProps) {
  const contentHeightRef = useRef<number | null>(null);

  return (
    <SpanCardQueryParamsProvider card={card}>
      <Panel ref={ref} style={style} {...rest} data-test-id="span-card-panel">
        <PanelBody>
          <Stack gap="sm">
            <SpanCardToolbar
              card={card}
              dragListeners={dragListeners}
              dragAttributes={dragAttributes}
            />
            {isAnyDragging ? (
              <DnDPlaceholder
                isDragging={isDragging}
                contentHeight={contentHeightRef.current}
              />
            ) : null}
            <Activity mode={isAnyDragging ? 'hidden' : 'visible'}>
              <Container
                ref={containerRef => {
                  if (!isAnyDragging && containerRef) {
                    contentHeightRef.current = containerRef.offsetHeight ?? null;
                  }
                }}
                padding="0 xl xl"
              >
                <SpanCardBody card={card} />
              </Container>
            </Activity>
          </Stack>
        </PanelBody>
      </Panel>
    </SpanCardQueryParamsProvider>
  );
}

function SpanCardBody({card}: {card: SpanCard}) {
  const {isReady} = usePageFilters();
  const query = useQueryParamsQuery();
  const [tab, setTab] = useTab();
  const organization = useOrganization();
  const crossEventDatasetAvailability = useCrossEventDatasetAvailability(organization);
  const crossEventQueries = useCrossEventQueries(crossEventDatasetAvailability);
  const visualizes = useQueryParamsVisualizes();
  const extrapolate = useQueryParamsExtrapolate();

  const queryExtras = useMemo(
    () => ({
      caseInsensitive: card.caseInsensitive,
      ...crossEventQueries,
    }),
    [card.caseInsensitive, crossEventQueries]
  );

  const isAggregateTab = tab === Mode.AGGREGATE;
  const isSpanTab = tab === Tab.SPAN;
  const isTraceTab = tab === Tab.TRACE;

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    limit: RESULT_LIMIT,
    enabled: isReady && isAggregateTab,
    queryExtras,
  });
  const spansTableResult = useExploreSpansTable({
    query,
    limit: RESULT_LIMIT,
    enabled: isReady && isSpanTab,
    queryExtras,
  });
  const tracesTableQuery = useQuery({
    ...useExploreTracesTableApiOptions({
      query,
      limit: RESULT_LIMIT,
      queryExtras,
    }),
    select: selectJsonWithHeaders,
    enabled: isReady && isTraceTab,
  });
  const tracesTableResult = {
    result: tracesTableQuery,
    error: parseError(tracesTableQuery.error),
  } satisfies TracesTableResult;

  const {result: timeseriesResult, samplingMode: timeseriesSamplingMode} =
    useExploreTimeseries({
      query,
      enabled: isReady,
      queryExtras,
    });

  const confidences = useMemo(
    () =>
      visualizes.map(visualize => {
        const series = (timeseriesResult.data[visualize.yAxis] ?? []).filter(defined);
        return combineConfidenceForSeries(series);
      }),
    [timeseriesResult.data, visualizes]
  );

  const error = defined(timeseriesResult.error)
    ? null
    : isSpanTab
      ? spansTableResult.result.error
      : isTraceTab
        ? tracesTableResult.error
        : isAggregateTab
          ? aggregatesTableResult.result.error
          : null;

  return (
    <Stack gap="md">
      {defined(error) && (
        <Alert.Container>
          <Alert variant="danger">{error.message}</Alert>
        </Alert.Container>
      )}
      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="md" align="start">
        <Container minWidth="0">
          <SpanCardChart
            timeseriesResult={timeseriesResult}
            samplingMode={timeseriesSamplingMode}
          />
        </Container>
        <Container
          minWidth="0"
          maxHeight={`${SPAN_CARD_CHART_HEIGHT + 80}px`}
          overflow="auto"
        >
          <ExploreTables
            aggregatesTableResult={aggregatesTableResult}
            spansTableResult={spansTableResult}
            tracesTableResult={tracesTableResult}
            confidences={confidences}
            tab={tab}
            setTab={newTab => setTab(newTab)}
          />
        </Container>
      </Grid>
      {extrapolate ? null : (
        <Alert.Container>
          <Alert variant="warning">{t('Extrapolation is disabled for this card.')}</Alert>
        </Alert.Container>
      )}
    </Stack>
  );
}

interface SpanCardChartProps {
  timeseriesResult: ReturnType<typeof useExploreTimeseries>['result'];
  samplingMode?: SamplingMode;
}

function SpanCardChart({timeseriesResult, samplingMode}: SpanCardChartProps) {
  const query = useQueryParamsQuery();
  const extrapolate = useQueryParamsExtrapolate();
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();
  const topEvents = useTopEvents();
  const [interval, setInterval, intervalOptions] = useSpanCardInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });
  const visualize = visualizes[0];

  const rawSpanCounts = useRawCounts({dataset: DiscoverDatasets.SPANS});

  const chartInfo: ChartInfo | null = useMemo(() => {
    if (!visualize) {
      return null;
    }

    const isTopN = defined(topEvents) && topEvents > 0;
    const series = timeseriesResult.data[visualize.yAxis] ?? [];
    let confidenceSeries = series;
    let samplingMeta = determineSeriesSampleCountAndIsSampled(confidenceSeries, isTopN);

    if (samplingMeta.sampleCount === 0 && !defined(samplingMeta.isSampled)) {
      confidenceSeries = timeseriesResult.data[DEFAULT_VISUALIZATION] ?? [];
      samplingMeta = determineSeriesSampleCountAndIsSampled(confidenceSeries, isTopN);
    }

    return {
      chartType: visualize.chartType,
      confidence: combineConfidenceForSeries(confidenceSeries),
      series,
      timeseriesResult,
      yAxis: visualize.yAxis,
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode,
    };
  }, [samplingMode, timeseriesResult, topEvents, visualize]);

  if (!visualize || !chartInfo) {
    return <LoadingIndicator />;
  }

  const chartIcon = CHART_TYPE_TO_ICON[visualize.chartType] ?? 'line';

  const actions = (
    <Fragment>
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            tooltipProps={{title: t('Type of chart displayed in this visualization')}}
            icon={<IconGraph type={chartIcon} />}
            variant="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        value={visualize.chartType}
        menuTitle={t('Type')}
        options={EXPLORE_CHART_TYPE_OPTIONS}
        onChange={option =>
          setVisualizes([visualize.replace({chartType: option.value}).serialize()])
        }
      />
      <CompactSelect
        value={interval}
        onChange={({value}) => setInterval(value)}
        trigger={triggerProps => (
          <OverlayTrigger.Button
            tooltipProps={{title: t('Time interval displayed in this visualization')}}
            {...triggerProps}
            icon={<IconClock />}
            variant="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        menuTitle={t('Interval')}
        options={intervalOptions}
      />
    </Fragment>
  );

  return (
    <Widget
      Title={
        <Widget.WidgetTitle
          title={prettifyAggregation(visualize.yAxis) ?? visualize.yAxis}
        />
      }
      Actions={actions}
      Visualization={<ChartVisualization chartInfo={chartInfo} />}
      Footer={
        <ConfidenceFooter
          extrapolate={extrapolate}
          sampleCount={chartInfo.sampleCount}
          isLoading={chartInfo.timeseriesResult?.isPending || false}
          isSampled={chartInfo.isSampled}
          confidence={chartInfo.confidence}
          topEvents={topEvents ? Math.min(topEvents, chartInfo.series.length) : undefined}
          dataScanned={chartInfo.dataScanned}
          rawSpanCounts={rawSpanCounts}
          userQuery={query.trim()}
        />
      }
      height={SPAN_CARD_CHART_HEIGHT}
      revealActions="always"
      borderless
    />
  );
}

function DnDPlaceholder({
  contentHeight,
  isDragging,
}: {
  contentHeight: number | null;
  isDragging: boolean | undefined;
}) {
  return (
    <Container
      height={contentHeight ? `${contentHeight}px` : undefined}
      padding="0 xl xl"
    >
      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="md" height="100%">
        <Placeholder height="100%">
          {isDragging ? <Text>{t('Charts are hidden while reordering.')}</Text> : null}
        </Placeholder>
        <Placeholder height="100%">
          {isDragging ? <Text>{t('Tables are hidden while reordering.')}</Text> : null}
        </Placeholder>
      </Grid>
    </Container>
  );
}
