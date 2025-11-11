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
  queryIndex,
  traceMetric,
  orientation,
  canChangeOrientation,
  isMetricOptionsEmpty,
  infoContentVisible,
  updateTableConfig,
}: {
  canChangeOrientation: boolean;
  infoContentVisible: boolean;
  isMetricOptionsEmpty: boolean;
  orientation: TableOrientation;
  queryIndex: number;
  timeseriesResult: ReturnType<typeof useMetricTimeseries>['result'];
  traceMetric: TraceMetric;
  updateTableConfig: ({
    visible,
    newOrientation,
  }: {
    newOrientation?: TableOrientation;
    visible?: boolean;
  }) => void;
}) {
  const additionalInfoTabActions = (
    <Flex direction="row">
      <PanelPositionSelector
        updateTableConfig={updateTableConfig}
        orientation={orientation}
        disabled={!canChangeOrientation || !infoContentVisible}
      />
      <HideContentButton
        orientation={orientation}
        infoContentHidden={!infoContentVisible}
        onToggle={() => updateTableConfig({visible: !infoContentVisible})}
      />
    </Flex>
  );
  return (
    <Stack>
      <StackedGraphWrapper>
        <MetricsGraph
          timeseriesResult={timeseriesResult}
          queryIndex={queryIndex}
          orientation={orientation}
          isMetricOptionsEmpty={isMetricOptionsEmpty}
        />
      </StackedGraphWrapper>
      <MetricInfoTabs
        traceMetric={traceMetric}
        additionalActions={additionalInfoTabActions}
        contentsHidden={!infoContentVisible}
        orientation={orientation}
        isMetricOptionsEmpty={isMetricOptionsEmpty}
      />
    </Stack>
  );
}

const StackedGraphWrapper = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
`;
