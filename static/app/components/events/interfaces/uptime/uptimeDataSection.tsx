import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {usePageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import type {TimeWindow} from 'sentry/components/checkInTimeline/types';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import {getTimeRangeFromEvent} from 'sentry/components/checkInTimeline/utils/getTimeRangeFromEvent';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {type Group, GroupActivityType, GroupStatus} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {ResolutionSelector} from 'sentry/views/monitors/components/overviewTimeline/resolutionSelector';

interface Props {
  event: Event;
  group: Group;
  project: Project;
}

const DOWNTIME_START_TYPES = [
  GroupActivityType.SET_UNRESOLVED,
  GroupActivityType.FIRST_SEEN,
  GroupActivityType.SET_REGRESSION,
];

const DOWNTIME_TERMINAL_TYPES = [GroupActivityType.SET_RESOLVED];

export function useDowntimeDuration({group}: {group: Group}): {
  durationMs: number;
  endDate: Date;
  startDate: Date;
} {
  const [now] = useState(() => new Date());
  const downtimeStartActivity = group.activity.find(activity =>
    DOWNTIME_START_TYPES.includes(activity.type)
  );
  const downtimeEndActivity = group.activity.find(activity =>
    DOWNTIME_TERMINAL_TYPES.includes(activity.type)
  );
  const startDate = new Date(downtimeStartActivity?.dateCreated ?? group.firstSeen);
  const endDate =
    group.status === GroupStatus.RESOLVED
      ? new Date(downtimeEndActivity?.dateCreated ?? group.lastSeen)
      : now;

  const durationMs = endDate.getTime() - startDate.getTime();
  return {durationMs, startDate, endDate};
}

export function DowntimeDuration({group}: {group: Group}) {
  const {durationMs, startDate, endDate} = useDowntimeDuration({group});
  return (
    <Tooltip
      title={
        <DowntimeTooltipTitle>
          <DowntimeLabel>{t('From:')}</DowntimeLabel>
          <DateTime date={startDate} timeZone />
          <DowntimeLabel>{t('To:')}</DowntimeLabel>
          {group.status === GroupStatus.RESOLVED ? (
            <DateTime date={endDate} timeZone />
          ) : (
            t('Now')
          )}
        </DowntimeTooltipTitle>
      }
      showUnderline
    >
      <Duration seconds={durationMs / 1000} />
    </Tooltip>
  );
}

export function UptimeDataSection({group, event, project}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const now = useMemo(() => new Date(), []);

  const isResolved = group.status === GroupStatus.RESOLVED;
  const alertRuleId = event.tags.find(tag => tag.key === 'uptime_rule')?.value;

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindow = location.query?.timeWindow as TimeWindow;
  const {since, until} = usePageFilterDates();

  const timeWindowConfig = useMemo(() => {
    if (defined(timeWindow)) {
      const {start, end} = getTimeRangeFromEvent(event, now, timeWindow);
      return getConfigFromTimeRange(start, end, timelineWidth);
    }
    return getConfigFromTimeRange(since, until, timelineWidth);
  }, [timeWindow, timelineWidth, since, until, event, now]);

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    ruleIds: alertRuleId ? [alertRuleId] : [],
    timeWindowConfig,
  });
  const bucketedData = alertRuleId ? uptimeStats?.[alertRuleId] ?? [] : [];

  const actions = (
    <ButtonBar gap={1}>
      {defined(alertRuleId) && (
        <LinkButton
          icon={<IconSettings />}
          size="xs"
          to={makeAlertsPathname({
            path: `/rules/uptime/${project.slug}/${alertRuleId}/details/`,
            organization,
          })}
        >
          {t('Uptime Alert Rule')}
        </LinkButton>
      )}
      <ResolutionSelector />
    </ButtonBar>
  );

  return (
    <InterimSection
      title={t('Downtime Information')}
      type={SectionKey.DOWNTIME}
      help={t('Information about the detected downtime')}
      preventCollapse
      actions={actions}
    >
      <Text>
        {isResolved
          ? tct('Domain was down for [duration]', {
              duration: <DowntimeDuration group={group} />,
            })
          : tct('Domain has been down for [duration]', {
              duration: <DowntimeDuration group={group} />,
            })}
      </Text>
      <TimelineContainer>
        <TimelineWidthTracker ref={elementRef} />
        <StyledGridLineTimeLabels timeWindowConfig={timeWindowConfig} />
        <GridLineOverlay timeWindowConfig={timeWindowConfig} showCursor={!isPending} />
        {bucketedData && !isPending ? (
          <FadeInContainer>
            <CheckInTimeline
              statusLabel={statusToText}
              statusStyle={tickStyle}
              statusPrecedent={checkStatusPrecedent}
              timeWindowConfig={timeWindowConfig}
              bucketedData={bucketedData}
            />
          </FadeInContainer>
        ) : (
          <CheckInPlaceholder />
        )}
      </TimelineContainer>
    </InterimSection>
  );
}

const DowntimeTooltipTitle = styled('div')`
  display: grid;
  column-gap: ${space(1)};
  grid-template-columns: max-content 1fr;
  justify-items: start;
`;

const DowntimeLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Text = styled('div')`
  margin-bottom: ${space(1)};
`;

const TimelineContainer = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 40px 100px;
  align-items: center;
`;

const StyledGridLineTimeLabels = styled(GridLineLabels)`
  border-bottom: 1px solid ${p => p.theme.border};
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 0;
`;

const FadeInContainer = styled('div')`
  animation: ${fadeIn} 500ms ease-out forwards;
`;
