import {Activity, Fragment, useRef, useState} from 'react';
import type {DraggableAttributes} from '@dnd-kit/core';
import type {SyntheticListenerMap} from '@dnd-kit/core/dist/hooks/utilities';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useMetricsPanelAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  getTraceSamplesTableFields,
  TraceSamplesTableColumns,
} from 'sentry/views/explore/metrics/constants';
import {unresolveExpression} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {useTableOrientationControl} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {SideBySideOrientation} from 'sentry/views/explore/metrics/metricPanel/sideBySideOrientation';
import {StackedOrientation} from 'sentry/views/explore/metrics/metricPanel/stackedOrientation';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsMode,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;

interface MetricPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  queryIndex: number;
  queryLabel: string;
  traceMetric: TraceMetric;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  isAnyDragging?: boolean;
  isDragging?: boolean;
  onEquationLabelsChange?: (equationLabel: string, labels: string[]) => void;
  ref?: React.Ref<HTMLDivElement>;
  referenceMap?: Record<string, string>;
  referencedMetricLabels?: Set<string>;
}

export function MetricPanel({
  traceMetric,
  queryIndex,
  queryLabel,
  referenceMap,
  dragListeners,
  isAnyDragging,
  isDragging,
  style,
  ref,
  dragAttributes,
  referencedMetricLabels,
  onEquationLabelsChange,
  ...rest
}: MetricPanelProps) {
  const organization = useOrganization();
  const {
    orientation,
    setOrientation: setUserPreferenceOrientation,
    canChangeOrientation,
  } = useTableOrientationControl();
  const [infoContentHidden, setInfoContentHidden] = useState(false);
  const {isMetricOptionsEmpty} = useMetricOptions({enabled: Boolean(traceMetric.name)});

  const hasMetricsUIRefresh = canUseMetricsUIRefresh(organization);
  const fields = getTraceSamplesTableFields(TraceSamplesTableColumns);

  const mode = useQueryParamsMode();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();
  const visualize = useMetricVisualize();

  const [title, setTitle] = useState<string | undefined>(() => {
    if (isVisualizeEquation(visualize)) {
      return unresolveExpression(visualize.expression.text, referenceMap);
    }
    return undefined;
  });

  const areQueriesEnabled = isVisualizeFunction(visualize)
    ? Boolean(traceMetric.name) && !isMetricOptionsEmpty
    : isVisualizeEquation(visualize) && Boolean(visualize.expression.text);

  const metricSamplesTableResult = useMetricSamplesTable({
    disabled: !areQueriesEnabled,
    limit: RESULT_LIMIT,
    traceMetric,
    fields,
    ingestionDelaySeconds: TWO_MINUTE_DELAY,
  });

  const metricAggregatesTableResult = useMetricAggregatesTable({
    enabled: areQueriesEnabled,
    limit: RESULT_LIMIT,
    traceMetric,
  });

  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled:
      !isMetricOptionsEmpty ||
      (isVisualizeEquation(visualize) && Boolean(visualize.expression.text)),
  });

  useMetricsPanelAnalytics({
    interval,
    isTopN: !!topEvents,
    metricAggregatesTableResult,
    metricSamplesTableResult,
    metricTimeseriesResult: timeseriesResult,
    mode,
    traceMetric,
    sortBys,
    aggregateSortBys,
    panelIndex: queryIndex,
  });

  const contentHeightRef = useRef<number | null>(null);

  if (hasMetricsUIRefresh) {
    return (
      <Panel ref={ref} style={style} {...rest} data-test-id="metric-panel">
        <PanelBody>
          <Stack gap="sm">
            <Container paddingBottom={visualize.visible ? undefined : 'sm'}>
              <MetricToolbar
                traceMetric={traceMetric}
                queryLabel={queryLabel}
                referenceMap={referenceMap}
                dragListeners={dragListeners}
                dragAttributes={dragAttributes}
                referencedMetricLabels={referencedMetricLabels}
                onEquationLabelsChange={onEquationLabelsChange}
                onTitleChange={setTitle}
              />
            </Container>
            {visualize.visible ? (
              <Fragment>
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
                  >
                    <SideBySideOrientation
                      timeseriesResult={timeseriesResult}
                      traceMetric={traceMetric}
                      setOrientation={setUserPreferenceOrientation}
                      orientation={orientation}
                      infoContentHidden={infoContentHidden}
                      setInfoContentHidden={setInfoContentHidden}
                      isMetricOptionsEmpty={isMetricOptionsEmpty}
                      title={title}
                    />
                  </Container>
                </Activity>
              </Fragment>
            ) : null}
          </Stack>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel data-test-id="metric-panel">
      <PanelBody>
        {orientation === 'right' ? (
          <SideBySideOrientation
            timeseriesResult={timeseriesResult}
            traceMetric={traceMetric}
            setOrientation={setUserPreferenceOrientation}
            orientation={orientation}
            infoContentHidden={infoContentHidden}
            setInfoContentHidden={setInfoContentHidden}
            isMetricOptionsEmpty={isMetricOptionsEmpty}
            title={title}
          />
        ) : (
          <StackedOrientation
            timeseriesResult={timeseriesResult}
            traceMetric={traceMetric}
            setOrientation={setUserPreferenceOrientation}
            orientation={orientation}
            canChangeOrientation={canChangeOrientation}
            infoContentHidden={infoContentHidden}
            setInfoContentHidden={setInfoContentHidden}
            isMetricOptionsEmpty={isMetricOptionsEmpty}
            title={title}
          />
        )}
      </PanelBody>
    </Panel>
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
    <Container height={contentHeight ? `${contentHeight}px` : undefined}>
      <Grid columns="1fr 1fr" gap="sm" height="100%">
        <Container padding="md">
          <Placeholder height="100%">
            {isDragging ? (
              <Text>
                {t(
                  "Charts are hidden while reordering. They're too expensive to drag along for the ride."
                )}
              </Text>
            ) : null}
          </Placeholder>
        </Container>
        <Container padding="md" paddingLeft="0">
          <Placeholder height="100%">
            {isDragging ? (
              <Text>
                {t("We gotta hide the tables too, they're also pretty expensive.")}
              </Text>
            ) : null}
          </Placeholder>
        </Container>
      </Grid>
    </Container>
  );
}
