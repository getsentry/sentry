import {useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function IssueCheckInTimeline() {
  const {detectorDetails} = useIssueDetails();
  const {detectorId, detectorType} = detectorDetails;
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    ruleIds: detectorType === 'uptime_monitor' && detectorId ? [detectorId] : [],
    timeWindowConfig,
  });

  return (
    <ChartContainer>
      <TimelineWidthTracker ref={elementRef} />
      <IssueGridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        timeWindowConfig={timeWindowConfig}
      />
      <GridLineLabels timeWindowConfig={timeWindowConfig} />
      {isPending ? (
        <CheckInPlaceholder />
      ) : (
        <CheckInTimeline
          bucketedData={detectorId ? uptimeStats?.[detectorId] ?? [] : []}
          statusLabel={statusToText}
          statusStyle={tickStyle}
          statusPrecedent={checkStatusPrecedent}
          timeWindowConfig={timeWindowConfig}
        />
      )}
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  min-height: 104px;
  width: 100%;
  position: relative;
`;

const IssueGridLineOverlay = styled(GridLineOverlay)`
  position: absolute;
  width: 100%;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
`;
