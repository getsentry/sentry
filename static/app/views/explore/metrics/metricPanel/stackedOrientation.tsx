import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {type TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {HideContentButton} from 'sentry/views/explore/metrics/metricPanel/hideContentButton';
import {PanelPositionSelector} from 'sentry/views/explore/metrics/metricPanel/panelPositionSelector';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function StackedOrientation({
  timeseriesResult,
  traceMetric,
  orientation,
  setOrientation,
  canChangeOrientation,
  infoContentHidden,
  setInfoContentHidden,
  isMetricOptionsEmpty,
}: {
  canChangeOrientation: boolean;
  infoContentHidden: boolean;
  isMetricOptionsEmpty: boolean;
  orientation: TableOrientation;
  setInfoContentHidden: (hidden: boolean) => void;
  setOrientation: (orientation: TableOrientation) => void;
  timeseriesResult: ReturnType<typeof useMetricTimeseries>['result'];
  traceMetric: TraceMetric;
}) {
  const additionalInfoTabActions = (
    <Flex direction="row">
      <PanelPositionSelector
        orientation={orientation}
        setOrientation={setOrientation}
        disabled={!canChangeOrientation || infoContentHidden}
      />
      <HideContentButton
        orientation={orientation}
        infoContentHidden={infoContentHidden}
        onToggle={() => setInfoContentHidden(!infoContentHidden)}
      />
    </Flex>
  );
  return (
    <Stack gap="sm">
      <StackedGraphWrapper>
        <MetricsGraph
          timeseriesResult={timeseriesResult}
          orientation={orientation}
          isMetricOptionsEmpty={isMetricOptionsEmpty}
        />
      </StackedGraphWrapper>
      <div>
        <MetricInfoTabs
          traceMetric={traceMetric}
          additionalActions={additionalInfoTabActions}
          contentsHidden={infoContentHidden}
          orientation={orientation}
          isMetricOptionsEmpty={isMetricOptionsEmpty}
        />
      </div>
    </Stack>
  );
}

const StackedGraphWrapper = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;
