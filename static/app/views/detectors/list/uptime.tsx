import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {Detector, UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import DetectorsList from 'sentry/views/detectors/list';
import {
  MonitorViewContext,
  useMonitorViewContext,
  type MonitorViewContextValue,
} from 'sentry/views/detectors/monitorViewContext';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';

function VisualizationCell({detector}: {detector: UptimeDetector}) {
  const uptimeDetectorId = detector.id;

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 1000);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    detectorIds: [uptimeDetectorId],
    timeWindowConfig,
  });

  return (
    <Cell
      data-column-name="visualization"
      padding="lg 0"
      borderLeft="muted"
      height="100%"
    >
      <Flex width="100%" height="100%" ref={elementRef} align="center">
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <CheckInTimeline
            statusLabel={statusToText}
            statusStyle={tickStyle}
            statusPrecedent={checkStatusPrecedent}
            timeWindowConfig={timeWindowConfig}
            bucketedData={uptimeStats?.[uptimeDetectorId] ?? []}
          />
        )}
      </Flex>
    </Cell>
  );
}

export default function UptimeDetectorsList() {
  const parentContext = useMonitorViewContext();

  const renderVisualization = useCallback((detector: Detector) => {
    if (detector.type === 'uptime_domain_failure') {
      return <VisualizationCell detector={detector} />;
    }
    return null;
  }, []);

  const contextValue = useMemo<MonitorViewContextValue>(
    () => ({
      ...parentContext,
      detectorFilter: 'uptime_domain_failure',
      renderVisualization,
      showTimeRangeSelector: true,
    }),
    [parentContext, renderVisualization]
  );

  return (
    <MonitorViewContext.Provider value={contextValue}>
      <DetectorsList />
    </MonitorViewContext.Provider>
  );
}

const Cell = styled(SimpleTable.RowCell)`
  z-index: 4;
`;
