import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {CronDetector, Detector} from 'sentry/types/workflowEngine/detectors';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import DetectorsList from 'sentry/views/detectors/list';
import {
  MonitorViewContext,
  useMonitorViewContext,
  type MonitorViewContextValue,
} from 'sentry/views/detectors/monitorViewContext';
import {CronsLandingPanel} from 'sentry/views/insights/crons/components/cronsLandingPanel';
import {
  checkInStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/crons/utils';
import {selectCheckInData} from 'sentry/views/insights/crons/utils/selectCheckInData';
import {useMonitorStats} from 'sentry/views/insights/crons/utils/useMonitorStats';

function VisualizationCell({detector}: {detector: CronDetector}) {
  const cronId = detector.dataSources[0].queryObj.id;
  const cronEnvironments = detector.dataSources[0].queryObj.environments;

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 1000);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const {data: monitorStats, isPending} = useMonitorStats({
    monitors: [detector.dataSources[0].queryObj.id],
    timeWindowConfig,
  });

  return (
    <Cell
      data-column-name="visualization"
      padding="lg 0"
      borderLeft="muted"
      height="100%"
    >
      <Stack gap="lg" width="100%" ref={elementRef}>
        {cronEnvironments.map(environment => {
          if (isPending) {
            return <CheckInPlaceholder key={environment.name} />;
          }
          return (
            <CheckInTimeline
              key={environment.name}
              statusLabel={statusToText}
              statusStyle={tickStyle}
              statusPrecedent={checkInStatusPrecedent}
              timeWindowConfig={timeWindowConfig}
              bucketedData={selectCheckInData(
                monitorStats?.[cronId] ?? [],
                environment.name
              )}
            />
          );
        })}
      </Stack>
    </Cell>
  );
}

export default function CronDetectorsList() {
  const parentContext = useMonitorViewContext();

  const renderVisualization = useCallback((detector: Detector) => {
    if (detector.type === 'monitor_check_in_failure') {
      return <VisualizationCell detector={detector} />;
    }
    return null;
  }, []);

  const contextValue = useMemo<MonitorViewContextValue>(
    () => ({
      ...parentContext,
      detectorFilter: 'monitor_check_in_failure',
      renderVisualization,
      showTimeRangeSelector: true,
      emptyState: <CronsLandingPanel />,
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
