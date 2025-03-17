import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import Panel from 'sentry/components/panels/panel';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {OverviewRow} from 'sentry/views/insights/uptime/components/overviewTimeline/overviewRow';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';

import type {CheckStatusBucket, UptimeRule} from './types';

interface Props {
  /**
   * Called when stats have been loaded for this timeline.
   */
  onStatsLoaded: (stats: CheckStatusBucket[]) => void;
  uptimeRule: UptimeRule;
}

export function DetailsTimeline({uptimeRule, onStatsLoaded}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);

  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {data: uptimeStats} = useUptimeMonitorStats({
    ruleIds: [uptimeRule.id],
    timeWindowConfig,
  });

  useEffect(
    () => uptimeStats?.[uptimeRule.id] && onStatsLoaded?.(uptimeStats[uptimeRule.id]!),
    [onStatsLoaded, uptimeStats, uptimeRule.id]
  );

  return (
    <Panel>
      <TimelineWidthTracker ref={elementRef} />
      <Header>
        <GridLineLabels timeWindowConfig={timeWindowConfig} />
      </Header>
      <AlignedGridLineOverlay allowZoom showCursor timeWindowConfig={timeWindowConfig} />
      <OverviewRow
        uptimeRule={uptimeRule}
        timeWindowConfig={timeWindowConfig}
        singleRuleView
      />
    </Panel>
  );
}

const Header = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
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
