import {useRef} from 'react';

import {Flex} from '@sentry/scraps/layout';

import SplitPanel from 'sentry/components/splitPanel';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {SAMPLES_PANEL_MIN_WIDTH} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {HideContentButton} from 'sentry/views/explore/metrics/metricPanel/hideContentButton';
import {PanelPositionSelector} from 'sentry/views/explore/metrics/metricPanel/panelPositionSelector';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useNavContext} from 'sentry/views/nav/context';

const MIN_LEFT_WIDTH = 400;

// Defined by the size of the expected samples tab component
const PADDING_SIZE = 16;
const MIN_RIGHT_WIDTH = SAMPLES_PANEL_MIN_WIDTH + PADDING_SIZE;

export function SideBySideOrientation({
  timeseriesResult,
  queryIndex,
  traceMetric,
  orientation,
  setOrientation,
  infoContentHidden,
  setInfoContentHidden,
  isMetricOptionsEmpty,
}: {
  infoContentHidden: boolean;
  isMetricOptionsEmpty: boolean;
  orientation: TableOrientation;
  queryIndex: number;
  setInfoContentHidden: (hidden: boolean) => void;
  setOrientation: (orientation: TableOrientation) => void;
  timeseriesResult: ReturnType<typeof useMetricTimeseries>['result'];
  traceMetric: TraceMetric;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});

  const hasSize = width > 0;
  const {isCollapsed: isNavCollapsed} = useNavContext();
  // Default split is 62.5% of the available width for collapsed nav, 55% for expanded nav,
  // but not less than MIN_LEFT_WIDTH while also accommodating the minimum right panel width.
  // We change the ratio depending on whether the nav is collapsed because if it is collapsed,
  // there is more space available to show the connected telemetry by default
  const splitRatio = isNavCollapsed ? 0.625 : 0.55;
  const defaultSplit = Math.min(
    Math.max(width * splitRatio, MIN_LEFT_WIDTH),
    width - MIN_RIGHT_WIDTH
  );

  const additionalActions = (
    <Flex direction="row" marginTop={infoContentHidden ? undefined : 'md'}>
      <PanelPositionSelector
        orientation={orientation}
        setOrientation={setOrientation}
        disabled={infoContentHidden}
      />
      <HideContentButton
        orientation={orientation}
        infoContentHidden={infoContentHidden}
        onToggle={() => setInfoContentHidden(!infoContentHidden)}
      />
    </Flex>
  );

  if (infoContentHidden) {
    return (
      <div ref={measureRef}>
        <MetricsGraph
          timeseriesResult={timeseriesResult}
          queryIndex={queryIndex}
          orientation={orientation}
          additionalActions={additionalActions}
          infoContentHidden={infoContentHidden}
          isMetricOptionsEmpty={isMetricOptionsEmpty}
        />
      </div>
    );
  }

  return (
    <div ref={measureRef}>
      {hasSize ? (
        <SplitPanel
          availableSize={width}
          left={{
            content: (
              <MetricsGraph
                timeseriesResult={timeseriesResult}
                queryIndex={queryIndex}
                orientation={orientation}
                isMetricOptionsEmpty={isMetricOptionsEmpty}
              />
            ),
            default: defaultSplit,
            min: MIN_LEFT_WIDTH,
            max: width - MIN_RIGHT_WIDTH,
          }}
          right={
            <MetricInfoTabs
              traceMetric={traceMetric}
              additionalActions={additionalActions}
              orientation={orientation}
              isMetricOptionsEmpty={isMetricOptionsEmpty}
            />
          }
        />
      ) : null}
    </div>
  );
}
