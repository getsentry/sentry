import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  Gridline,
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import type {StatsBucket} from 'sentry/components/checkInTimeline/types';
import {Flex} from 'sentry/components/container/flex';
import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
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

function useCronLegendStatuses({bucketStats}: {bucketStats: MonitorBucket[]}) {
  /**
   * Extract a list of statuses that have occurred at least once in the bucket stats.
   */
  return useMemo(() => {
    const statusMap: Record<CheckInStatus, boolean> = {
      [CheckInStatus.OK]: true,
      [CheckInStatus.ERROR]: false,
      [CheckInStatus.IN_PROGRESS]: false,
      [CheckInStatus.MISSED]: false,
      [CheckInStatus.TIMEOUT]: false,
      [CheckInStatus.UNKNOWN]: false,
    };
    bucketStats?.forEach(([_timestamp, bucketEnvMapping]) => {
      const bucketEnvMappingEntries = Object.values(bucketEnvMapping) as Array<
        StatsBucket<CheckInStatus>
      >;
      for (const statBucket of bucketEnvMappingEntries) {
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
    return (Object.keys(statusMap) as CheckInStatus[]).filter(
      status => statusMap[status]
    );
  }, [bucketStats]);
}

export function IssueCronCheckTimeline({group}: {group: Group; event?: Event}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const cronAlertId = useCronIssueAlertId({groupId: group.id});
  const {data: stats, isPending} = useMonitorStats({
    monitors: cronAlertId ? [cronAlertId] : [],
    timeWindowConfig,
  });

  const cronStats = useMemo(() => {
    if (!cronAlertId) {
      return [];
    }
    return stats?.[cronAlertId] ?? [];
  }, [cronAlertId, stats]);

  const statEnvironments = useMemo(() => {
    const envSet = cronStats.reduce((acc, [_, envs]) => {
      return new Set([...acc, ...Object.keys(envs)]);
    }, new Set<string>());
    return [...(envSet ?? [])];
  }, [cronStats]);

  const legendStatuses = useCronLegendStatuses({
    bucketStats: cronStats,
  });

  return (
    <ChartContainer envCount={statEnvironments.length}>
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
      <IssueGridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        timeWindowConfig={timeWindowConfig}
        labelPosition="center-bottom"
        envCount={statEnvironments.length}
      />
      <IssueGridLineLabels
        timeWindowConfig={timeWindowConfig}
        labelPosition="center-bottom"
        envCount={statEnvironments.length}
      />
      <TimelineContainer>
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <Fragment>
            {statEnvironments.map((env, index) => (
              <Fragment key={env}>
                {statEnvironments.length > 1 && (
                  <EnvironmentLabel
                    title={tct('Environment: [env]', {env})}
                    envIndex={index}
                  >
                    {env}
                  </EnvironmentLabel>
                )}
                <PositionedTimelineContainer
                  envIndex={index}
                  bucketedData={stats && env ? selectCheckInData(cronStats, env) : []}
                  statusLabel={statusToText}
                  statusStyle={tickStyle}
                  statusPrecedent={checkInStatusPrecedent}
                  timeWindowConfig={timeWindowConfig}
                />
              </Fragment>
            ))}
          </Fragment>
        )}
      </TimelineContainer>
    </ChartContainer>
  );
}

const timelineHeight = 14;
const environmentHeight = 16;
const paddingHeight = 8;
const totalHeight = timelineHeight + environmentHeight + paddingHeight;

const ChartContainer = styled('div')<{envCount: number}>`
  position: relative;
  width: 100%;
  min-height: ${p => Math.max(p.envCount - 1, 0) * totalHeight + 104}px;
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

const PositionedTimelineContainer = styled(CheckInTimeline)<{envIndex: number}>`
  top: calc(${p => p.envIndex * (environmentHeight + paddingHeight)}px);
`;

const EnvironmentLabel = styled(Tooltip)<{envIndex: number}>`
  position: absolute;
  user-select: none;
  font-weight: ${p => p.theme.fontWeightBold};
  top: ${p => p.envIndex * totalHeight + timelineHeight}px;
  left: 0;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
`;

const IssueGridLineLabels = styled(GridLineLabels)<{envCount: number}>`
  top: ${p => Math.max(p.envCount - 1, 0) * totalHeight + 68}px;
`;

const IssueGridLineOverlay = styled(GridLineOverlay)<{envCount: number}>`
  ${Gridline} {
    top: ${p => Math.max(p.envCount - 1, 0) * totalHeight + 68}px;
  }
`;
