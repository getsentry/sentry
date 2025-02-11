import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import type {StatsBucket} from 'sentry/components/checkInTimeline/types';
import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {getGroupEventQueryKey} from 'sentry/views/issueDetails/utils';
import {MonitorIndicator} from 'sentry/views/monitors/components/monitorIndicator';
import {CheckInStatus, type MonitorBucket} from 'sentry/views/monitors/types';
import {
  checkInStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/monitors/utils';
import {selectCheckInData} from 'sentry/views/monitors/utils/selectCheckInData';
import {useMonitorStats} from 'sentry/views/monitors/utils/useMonitorStats';

export function useCronIssueAlertId({groupId}: {groupId: string}): string | undefined {
  /**
   * This should be removed once the cron rule value is set on the issue.
   * This will fetch an event from the max range if the detector details
   * are not available (e.g. time range has changed and page refreshed)
   */
  const user = useUser();
  const organization = useOrganization();
  const {detectorDetails} = useIssueDetails();
  const {detectorId, detectorType} = detectorDetails;

  const hasCronDetector = detectorId && detectorType === 'cron_monitor';

  const {data: event} = useApiQuery<Event>(
    getGroupEventQueryKey({
      orgSlug: organization.slug,
      groupId,
      eventId: user.options.defaultIssueEvent,
      environments: [],
    }),
    {
      staleTime: Infinity,
      enabled: !hasCronDetector,
      retry: false,
    }
  );

  // Fall back to the fetched event since the legacy UI isn't nested within the provider the provider
  return hasCronDetector
    ? detectorId
    : event?.tags?.find(({key}) => key === 'monitor.id')?.value;
}

function useCronLegendStatuses({
  bucketStats,
  environments = [],
}: {
  bucketStats: MonitorBucket[];
  environments?: string[];
}) {
  /**
   * Extract a list of statuses that have occurred at least once in the bucket stats.
   */
  return useMemo(() => {
    const environmentSet = new Set(environments);
    const statusMap: Record<CheckInStatus, boolean> = {
      [CheckInStatus.OK]: true,
      [CheckInStatus.ERROR]: false,
      [CheckInStatus.IN_PROGRESS]: false,
      [CheckInStatus.MISSED]: false,
      [CheckInStatus.TIMEOUT]: false,
      [CheckInStatus.UNKNOWN]: false,
    };
    bucketStats?.forEach(([_timestamp, bucketEnvMapping]) => {
      const bucketEnvMappingEntries = Object.entries(bucketEnvMapping) as Array<
        [string, StatsBucket<CheckInStatus>]
      >;
      for (const [environment, statBucket] of bucketEnvMappingEntries) {
        // Ignore stats from other environments if specified, otherwise show all
        if (environmentSet.size > 0 && !environmentSet.has(environment)) {
          continue;
        }

        const statBucketEntries = Object.entries(statBucket) as Array<
          [CheckInStatus, number]
        >;
        for (const [status, count] of statBucketEntries) {
          if (count > 0 && !statusMap[status]) {
            statusMap[status] = true;
          }
        }
      }
    });
    return Object.keys(statusMap).filter(status => statusMap[status as CheckInStatus]);
  }, [bucketStats, environments]);
}

export function IssueCronCheckTimeline({group}: {group: Group}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const cronAlertId = useCronIssueAlertId({groupId: group.id});
  const eventView = useIssueDetailsEventView({group});

  const {data: cronStats, isPending} = useMonitorStats({
    monitors: cronAlertId ? [cronAlertId] : [],
    timeWindowConfig,
  });

  const legendStatuses = useCronLegendStatuses({
    bucketStats: cronStats?.[cronAlertId ?? ''] ?? [],
    environments: (eventView.environment as string[]) ?? [],
  });

  const stats = cronAlertId ? cronStats?.[cronAlertId] : [];

  return (
    <ChartContainer>
      <TimelineLegend ref={elementRef}>
        {!isPending &&
          legendStatuses.map(status => (
            <Flex align="center" gap={space(0.5)} key={status}>
              <MonitorIndicator status={status as CheckInStatus} size={8} />
              <TimelineLegendText>
                {statusToText[status as CheckInStatus]}
              </TimelineLegendText>
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
            // TODO(leander): Use the environment from the event view
            bucketedData={stats ? selectCheckInData(stats, 'prod') : []}
            statusLabel={statusToText}
            statusStyle={tickStyle}
            statusPrecedent={checkInStatusPrecedent}
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
`;
