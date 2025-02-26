import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {CheckIndicator} from 'sentry/views/alerts/rules/uptime/checkIndicator';
import {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {getGroupEventQueryKey} from 'sentry/views/issueDetails/utils';

export function useUptimeIssueAlertId({groupId}: {groupId: string}): string | undefined {
  /**
   * This should be removed once the uptime rule value is set on the issue.
   * This will fetch an event from the max range if the detector details
   * are not available (e.g. time range has changed and page refreshed)
   */
  const user = useUser();
  const organization = useOrganization();
  const {detectorDetails} = useIssueDetails();
  const {detectorId, detectorType} = detectorDetails;

  const hasUptimeDetector = detectorId && detectorType === 'uptime_monitor';

  const {data: event} = useApiQuery<Event>(
    getGroupEventQueryKey({
      orgSlug: organization.slug,
      groupId,
      eventId: user.options.defaultIssueEvent,
      environments: [],
    }),
    {
      staleTime: Infinity,
      enabled: !hasUptimeDetector,
      retry: false,
    }
  );

  // Fall back to the fetched event since the legacy UI isn't nested within the provider the provider
  return hasUptimeDetector
    ? detectorId
    : event?.tags?.find(tag => tag.key === 'uptime_rule')?.value;
}

export function IssueUptimeCheckTimeline({group}: {group: Group}) {
  const uptimeAlertId = useUptimeIssueAlertId({groupId: group.id});
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    ruleIds: uptimeAlertId ? [uptimeAlertId] : [],
    timeWindowConfig,
  });

  const legendStatuses = useMemo(() => {
    const hasUnknownStatus =
      uptimeAlertId &&
      uptimeStats?.[uptimeAlertId]?.some(
        ([_, stats]) => stats[CheckStatus.MISSED_WINDOW] > 0
      );

    const statuses = [
      CheckStatus.SUCCESS,
      CheckStatus.FAILURE,
      CheckStatus.FAILURE_INCIDENT,
    ];

    if (hasUnknownStatus) {
      statuses.push(CheckStatus.MISSED_WINDOW);
    }

    return statuses;
  }, [uptimeAlertId, uptimeStats]);

  return (
    <ChartContainer>
      <TimelineLegend ref={elementRef} role="caption">
        {legendStatuses.map(status => (
          <Flex align="center" gap={space(0.5)} key={status}>
            <CheckIndicator status={status} width={8} />
            <TimelineLegendText>{statusToText[status]}</TimelineLegendText>
          </Flex>
        ))}
      </TimelineLegend>
      <GridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        timeWindowConfig={timeWindowConfig}
        labelPosition="center-bottom"
      />
      <GridLineLabels timeWindowConfig={timeWindowConfig} labelPosition="center-bottom" />
      <TimelineContainer>
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
      </TimelineContainer>
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  position: relative;
  min-height: 104px;
  width: 100%;
`;

const TimelineLegend = styled('div')`
  position: absolute;
  width: 100%;
  user-select: none;
  display: flex;
  gap: ${space(1)};
  margin-top: ${space(1.5)};
`;

const TimelineLegendText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TimelineContainer = styled('div')`
  position: absolute;
  top: 36px;
  width: 100%;
`;
