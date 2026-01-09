import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {Flex} from 'sentry/components/core/layout';
import {tn} from 'sentry/locale';
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
import {useIssueTimeWindowConfig} from 'sentry/views/issueDetails/streamline/useIssueTimeWindowConfig';
import {getGroupEventQueryKey} from 'sentry/views/issueDetails/utils';

export function useUptimeIssueDetectorId({
  groupId,
}: {
  groupId: string;
}): string | undefined {
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

  const evidenceDetectorId = event?.occurrence?.evidenceData.detectorId
    ? String(event?.occurrence?.evidenceData.detectorId)
    : undefined;

  // Fall back to the fetched event since the legacy UI isn't nested within the provider the provider
  return hasUptimeDetector ? detectorId : evidenceDetectorId;
}

export function IssueUptimeCheckTimeline({group}: {group: Group}) {
  const detectorId = useUptimeIssueDetectorId({groupId: group.id});
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindowConfig = useIssueTimeWindowConfig({timelineWidth, group});

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    detectorIds: detectorId ? [detectorId] : [],
    timeWindowConfig,
  });

  const legendStatuses = useMemo(() => {
    const hasUnknownStatus =
      detectorId &&
      uptimeStats?.[detectorId]?.some(
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
  }, [detectorId, uptimeStats]);

  return (
    <ChartContainer>
      <TimelineLegend ref={elementRef} role="caption">
        {legendStatuses.map(status => (
          <Flex align="center" gap="xs" key={status}>
            <CheckIndicator status={status} width={8} />
            <TimelineLegendText>{statusToText[status]}</TimelineLegendText>
          </Flex>
        ))}
      </TimelineLegend>
      <StyledGridLineOverlay
        allowZoom
        showCursor
        timeWindowConfig={timeWindowConfig}
        labelPosition="center-bottom"
        cursorOverlayAnchor="bottom"
        cursorOverlayAnchorOffset={2}
      />
      <GridLineLabels timeWindowConfig={timeWindowConfig} labelPosition="center-bottom" />
      <TimelineContainer>
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <CheckInTimeline
            bucketedData={detectorId ? (uptimeStats?.[detectorId] ?? []) : []}
            statusLabel={statusToText}
            statusStyle={tickStyle}
            statusPrecedent={checkStatusPrecedent}
            timeWindowConfig={timeWindowConfig}
            makeUnit={count => tn('check', 'checks', count)}
          />
        )}
      </TimelineContainer>
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  position: relative;
  min-height: 100px;
  width: 100%;
  padding-left: ${p => p.theme.space.lg};
  padding-right: ${p => p.theme.space.lg};
`;

const TimelineLegend = styled('div')`
  position: absolute;
  width: calc(100% - ${p => p.theme.space.lg} * 2);
  user-select: none;
  display: flex;
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.lg};
`;

const TimelineLegendText = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
`;

const TimelineContainer = styled('div')`
  position: absolute;
  top: 36px;
  width: calc(100% - ${p => p.theme.space.lg} * 2);
`;

const StyledGridLineOverlay = styled(GridLineOverlay)`
  width: calc(100% - ${p => p.theme.space.lg} * 2);
`;
