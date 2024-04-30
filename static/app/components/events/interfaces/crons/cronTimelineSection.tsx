import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {Overlay} from 'sentry/components/overlay';
import Panel from 'sentry/components/panels/panel';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useRouter from 'sentry/utils/useRouter';
import {ResolutionSelector} from 'sentry/views/monitors/components/overviewTimeline/resolutionSelector';
import {CheckInPlaceholder} from 'sentry/views/monitors/components/timeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/views/monitors/components/timeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/views/monitors/components/timeline/gridLines';
import type {
  MonitorBucketData,
  TimeWindow,
} from 'sentry/views/monitors/components/timeline/types';
import {getConfigFromTimeRange} from 'sentry/views/monitors/components/timeline/utils/getConfigFromTimeRange';
import {getTimeRangeFromEvent} from 'sentry/views/monitors/components/timeline/utils/getTimeRangeFromEvent';

interface Props {
  event: Event;
  organization: Organization;
  project: Project;
}

const DEFAULT_ENVIRONMENT = 'production';

export function CronTimelineSection({event, organization, project}: Props) {
  const {location} = useRouter();
  const timeWindow: TimeWindow = location.query?.timeWindow ?? '24h';
  const monitorId = event.tags.find(({key}) => key === 'monitor.id')?.value;
  const monitorSlug = event.tags.find(({key}) => key === 'monitor.slug')?.value;
  const environment = event.tags.find(({key}) => key === 'environment')?.value;

  const nowRef = useRef(new Date());
  const {start, end} = getTimeRangeFromEvent(event, nowRef.current, timeWindow);
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const timeWindowConfig = getConfigFromTimeRange(start, end, timelineWidth);
  const rollup = Math.floor((timeWindowConfig.elapsedMinutes * 60) / timelineWidth);

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;
  const {data: monitorStats, isLoading} = useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          until: Math.floor(end.getTime() / 1000),
          since: Math.floor(start.getTime() / 1000),
          monitor: monitorId,
          resolution: `${rollup}s`,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!monitorId && timelineWidth > 0,
    }
  );

  if (!monitorId) {
    return null;
  }

  const msPerPixel = (timeWindowConfig.elapsedMinutes * 60 * 1000) / timelineWidth;
  const eventTickLeft =
    (new Date(event.dateReceived).valueOf() - start.valueOf()) / msPerPixel;

  const actions = (
    <ButtonBar gap={1}>
      <LinkButton
        size="xs"
        icon={<IconOpen />}
        to={`/organizations/${organization.slug}/crons/${project.slug}/${monitorSlug}`}
      >
        {t('View in Monitor Details')}
      </LinkButton>
      <ResolutionSelector />
    </ButtonBar>
  );

  return (
    <EventDataSection
      title={t('Check-ins')}
      type="check-ins"
      help={t('A timeline of check-ins that happened before and after this event')}
      actions={actions}
    >
      <TimelineContainer>
        <TimelineWidthTracker ref={elementRef} />
        <StyledGridLineTimeLabels
          timeWindowConfig={timeWindowConfig}
          width={timelineWidth}
        />
        <GridLineOverlay
          showCursor={!isLoading}
          timeWindowConfig={timeWindowConfig}
          width={timelineWidth}
        />
        {monitorStats && !isLoading ? (
          <Fragment>
            <EventLineTick left={eventTickLeft} />
            <EventLineLabel left={eventTickLeft} timelineWidth={timelineWidth}>
              {t('Event Created')}
            </EventLineLabel>
            <FadeInContainer>
              <CheckInTimeline
                width={timelineWidth}
                bucketedData={monitorStats[monitorId]}
                timeWindowConfig={timeWindowConfig}
                environment={environment ?? DEFAULT_ENVIRONMENT}
              />
            </FadeInContainer>
          </Fragment>
        ) : (
          <CheckInPlaceholder />
        )}
      </TimelineContainer>
    </EventDataSection>
  );
}

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

const EventLineTick = styled('div')<{left: number}>`
  background: ${p => p.theme.translucentBorder};
  width: 2px;
  height: 100%;
  grid-row: 2 / 3;
  position: absolute;
  top: 0;
  left: ${p => p.left}px;
  transform: translateX(-2px);
`;

const EventLineLabel = styled(Overlay)<{left: number; timelineWidth: number}>`
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  position: absolute;
  bottom: ${space(1)};
  left: clamp(0px, ${p => p.left}px, calc(${p => p.timelineWidth}px - 50px));
  transform: translateX(-50%);
`;

const FadeInContainer = styled('div')`
  animation: ${fadeIn} 500ms ease-out forwards;
`;
