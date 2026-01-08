import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import Panel from 'sentry/components/panels/panel';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {OverviewRow} from 'sentry/views/insights/uptime/components/overviewTimeline/overviewRow';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';

import type {CheckStatusBucket} from './types';

interface Props {
  /**
   * Called when stats have been loaded for this timeline.
   */
  onStatsLoaded: (stats: CheckStatusBucket[]) => void;
  uptimeDetector: UptimeDetector;
}

export function DetailsTimeline({uptimeDetector, onStatsLoaded}: Props) {
  const {id} = uptimeDetector;
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);

  const timeWindowConfig = useTimeWindowConfig({
    timelineWidth,
    recomputeInterval: 60_000,
    recomputeOnWindowFocus: true,
  });

  const {data: uptimeStats} = useUptimeMonitorStats({
    detectorIds: [String(uptimeDetector.id)],
    timeWindowConfig,
  });

  useEffect(
    () => uptimeStats?.[id] && onStatsLoaded?.(uptimeStats[id]),
    [onStatsLoaded, uptimeStats, id]
  );

  return (
    <Panel>
      <TimelineWidthTracker ref={elementRef} />
      <Header>
        <GridLineLabels timeWindowConfig={timeWindowConfig} />
      </Header>
      <AlignedGridLineOverlay
        allowZoom
        resetPaginationOnZoom
        showCursor
        timeWindowConfig={timeWindowConfig}
        cursorOverlayAnchor="top"
        cursorOverlayAnchorOffset={10}
      />
      <OverviewRow
        uptimeDetector={uptimeDetector}
        timeWindowConfig={timeWindowConfig}
        single
      />
    </Panel>
  );
}

const Header = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  z-index: 1;
`;

const AlignedGridLineOverlay = styled(GridLineOverlay)`
  position: absolute;
  top: 0;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
`;
