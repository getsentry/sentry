import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/utils/useChartInterval';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';
import {SpanFields} from 'sentry/views/insights/types';

const CONVERSATION_SPANS_FILTER = `has:${SpanFields.GEN_AI_CONVERSATION_ID}`;
const AI_CLIENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;

const CHART_VISUALIZATIONS = {
  cost: {
    label: t('Cost'),
    yAxis: `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`,
    filter: `${CONVERSATION_SPANS_FILTER} ${AI_CLIENT_FILTER}`,
  },
  messages: {
    label: t('Total Messages'),
    yAxis: `count(${SpanFields.SPAN_DURATION})`,
    filter: `${CONVERSATION_SPANS_FILTER} ${AI_CLIENT_FILTER}`,
  },
  chats: {
    label: t('Individual Chats'),
    yAxis: `count_unique(${SpanFields.GEN_AI_CONVERSATION_ID})`,
    filter: CONVERSATION_SPANS_FILTER,
  },
} as const satisfies Record<string, {filter: string; label: string; yAxis: string}>;

type ChartVisualizationKey = keyof typeof CHART_VISUALIZATIONS;

const VISUALIZATION_OPTIONS = Object.entries(CHART_VISUALIZATIONS).map(
  ([value, {label}]) => ({value: value as ChartVisualizationKey, label})
);

const CHART_TYPE_OPTIONS = [
  {value: 'line' as const, label: t('Line')},
  {value: 'bar' as const, label: t('Bar')},
];

const visualizationParser = parseAsStringLiteral(
  Object.keys(CHART_VISUALIZATIONS) as ChartVisualizationKey[]
).withDefault('cost');

const chartTypeParser = parseAsStringLiteral(['line', 'bar'] as const).withDefault('bar');

export function ConversationsChart() {
  const [visualization, setVisualization] = useQueryState(
    'chartVisualization',
    visualizationParser
  );
  const [chartType, setChartType] = useQueryState('chartType', chartTypeParser);
  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_BIGGEST,
  });

  const {label, yAxis, filter} = CHART_VISUALIZATIONS[visualization];
  const query = useCombinedQuery(filter);

  const {data, isPending, error} = useFetchSpanTimeSeries(
    {
      yAxis: [yAxis],
      query,
      interval,
    },
    Referrer.CHART
  );

  const timeSeries = data?.timeSeries[0];

  const plottables = useMemo(() => {
    if (!timeSeries) {
      return [];
    }
    const PlottableConstructor = chartType === 'line' ? Line : Bars;
    return [
      new PlottableConstructor(markDelayedData(timeSeries, INGESTION_DELAY), {
        alias: label,
      }),
    ];
  }, [timeSeries, chartType, label]);

  const chartTypeLabel =
    CHART_TYPE_OPTIONS.find(option => option.value === chartType)?.label ?? '';
  const intervalLabel =
    intervalOptions.find(option => option.value === interval)?.label ?? interval;

  const Title = (
    <CompactSelect
      trigger={triggerProps => (
        <TitleTrigger {...triggerProps} variant="transparent" size="xs">
          <Heading as="h3" size="lg">
            {label}
          </Heading>
        </TitleTrigger>
      )}
      value={visualization}
      options={VISUALIZATION_OPTIONS}
      onChange={option => setVisualization(option.value)}
    />
  );

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconGraph type={chartType} />}
              variant="transparent"
              size="xs"
            >
              {chartTypeLabel}
            </OverlayTrigger.Button>
          )}
          value={chartType}
          menuTitle={t('Type')}
          options={CHART_TYPE_OPTIONS}
          onChange={option => setChartType(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconClock />}
              variant="transparent"
              size="xs"
            >
              {intervalLabel}
            </OverlayTrigger.Button>
          )}
          value={interval}
          menuTitle={t('Interval')}
          options={intervalOptions}
          onChange={option => setInterval(option.value)}
        />
      </Tooltip>
    </Fragment>
  );

  const Visualization = isPending ? (
    <TimeSeriesWidgetVisualization.LoadingPlaceholder />
  ) : error ? (
    <Container position="absolute" inset={0}>
      <Widget.WidgetError error={error} />
    </Container>
  ) : plottables.length === 0 ? (
    <Container position="absolute" inset={0}>
      <Widget.WidgetError error={MISSING_DATA_MESSAGE} />
    </Container>
  ) : (
    <TimeSeriesWidgetVisualization plottables={plottables} />
  );

  return (
    <Widget
      Title={Title}
      Actions={Actions}
      Visualization={Visualization}
      height={195}
      revealActions="always"
    />
  );
}

// Pull the trigger left so the label's text edge aligns with the chart's
// left edge, rather than being indented by the button's own padding.
const TitleTrigger = styled(OverlayTrigger.Button)`
  margin-left: -${p => p.theme.space.xs};
`;
