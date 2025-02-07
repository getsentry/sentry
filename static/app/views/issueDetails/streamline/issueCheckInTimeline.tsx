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
import type {Group} from 'sentry/types/group';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useUser} from 'sentry/utils/useUser';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

export function useUptimeIssueAlertId({groupId}: {groupId: string}): string | undefined {
  /**
   * This should be removed once the uptime rule value is set on the issue.
   * This will fetch an event from the max range if the detector details
   * are not available (e.g. time range has changed and page refreshed)
   */
  const user = useUser();
  const {detectorDetails} = useIssueDetails();
  const {detectorId, detectorType} = detectorDetails;

  const hasUptimeDetector = detectorId && detectorType === 'uptime_monitor';

  const {data: event} = useGroupEvent({
    groupId,
    eventId: user.options.defaultIssueEvent,
    options: {
      enabled: !hasUptimeDetector,
      period: {statsPeriod: '90d'},
    },
  });

  // Fall back to the fetched event since the legacy UI isn't nested within the provider the provider
  return hasUptimeDetector
    ? detectorId
    : event?.tags?.find(tag => tag.key === 'uptime_rule')?.value;
}

export function IssueCheckInTimeline({group}: {group: Group}) {
  const uptimeAlertId = useUptimeIssueAlertId({groupId: group.id});
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    ruleIds: uptimeAlertId ? [uptimeAlertId] : [],
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
          bucketedData={uptimeAlertId ? uptimeStats?.[uptimeAlertId] ?? [] : []}
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
