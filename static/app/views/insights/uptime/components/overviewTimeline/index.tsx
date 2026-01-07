import {useRef} from 'react';
import styled from '@emotion/styled';

import {DateNavigator} from 'sentry/components/checkInTimeline/dateNavigator';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useDateNavigation} from 'sentry/components/checkInTimeline/hooks/useDateNavigation';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import Panel from 'sentry/components/panels/panel';
import {Sticky} from 'sentry/components/sticky';
import {space} from 'sentry/styles/space';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useUptimeMonitorSummaries} from 'sentry/views/insights/uptime/utils/useUptimeMonitorSummary';

import {OverviewRow} from './overviewRow';

interface Props {
  uptimeDetectors: UptimeDetector[];
}

export function OverviewTimeline({uptimeDetectors}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);

  const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const dateNavigation = useDateNavigation();

  const {data: summaries} = useUptimeMonitorSummaries({
    detectorIds: uptimeDetectors.map(detector => detector.id),
    timeWindowConfig,
  });

  return (
    <MonitorListPanel role="region">
      <TimelineWidthTracker ref={elementRef} />
      <Header>
        <HeaderControlsLeft>
          <DateNavigator
            dateNavigation={dateNavigation}
            direction="back"
            size="xs"
            borderless
          />
        </HeaderControlsLeft>
        <AlignedGridLineLabels timeWindowConfig={timeWindowConfig} />
        <HeaderControlsRight>
          <DateNavigator
            dateNavigation={dateNavigation}
            direction="forward"
            size="xs"
            borderless
          />
        </HeaderControlsRight>
      </Header>
      <AlignedGridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        cursorOffsets={{right: 40}}
        timeWindowConfig={timeWindowConfig}
        cursorOverlayAnchor="top"
        cursorOverlayAnchorOffset={10}
      />
      <UptimeAlertRow>
        {uptimeDetectors.map(detector => (
          <OverviewRow
            key={detector.id}
            timeWindowConfig={timeWindowConfig}
            uptimeDetector={detector}
            summary={
              summaries === undefined ? undefined : (summaries[detector.id] ?? null)
            }
          />
        ))}
      </UptimeAlertRow>
    </MonitorListPanel>
  );
}

const Header = styled(Sticky)`
  display: grid;
  grid-column: 1/-1;
  grid-template-columns: subgrid;

  z-index: 1;
  background: ${p => p.theme.tokens.background.primary};
  border-top-left-radius: ${p => p.theme.radius.md};
  border-top-right-radius: ${p => p.theme.radius.md};
  box-shadow: 0 1px ${p => p.theme.translucentBorder};

  &[data-stuck] {
    border-radius: 0;
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
    margin: 0 -1px;
  }
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 2/-1;
`;
const AlignedGridLineOverlay = styled(GridLineOverlay)`
  grid-row: 1;
  grid-column: 2/-1;
`;

const AlignedGridLineLabels = styled(GridLineLabels)`
  box-shadow: -1px 0 0 0 ${p => p.theme.tokens.border.transparent.neutral.muted};
  grid-row: 1;
  grid-column: 2/-1;
`;

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 1fr max-content;
`;

const UptimeAlertRow = styled('ul')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const HeaderControlsLeft = styled('div')`
  grid-column: 1;
  display: flex;
  justify-content: flex-end;
  padding: ${space(1.5)} ${space(2)};
`;

const HeaderControlsRight = styled('div')`
  grid-row: 1;
  grid-column: -1;
  padding: ${space(1.5)} ${space(2)};
`;
