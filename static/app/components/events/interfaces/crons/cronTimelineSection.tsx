import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useRouter from 'sentry/utils/useRouter';
import {CheckInTimeline} from 'sentry/views/monitors/components/overviewTimeline/checkInTimeline';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/gridLines';
import {
  MonitorBucketData,
  TimeWindow,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {timeWindowConfig} from 'sentry/views/monitors/components/overviewTimeline/utils';
import {getTimeRangeFromEvent} from 'sentry/views/monitors/utils/getTimeRangeFromEvent';

interface Props {
  event: Event;
  organization: Organization;
}

const DEFAULT_ENVIRONMENT = 'production';

export function CronTimelineSection({event, organization}: Props) {
  const {replace, location} = useRouter();
  const monitorSlug = event.tags.find(({key}) => key === 'monitor.slug')?.value;
  const environment = event.tags.find(({key}) => key === 'environment')?.value;
  const timeWindow: TimeWindow = location.query?.timeWindow ?? '24h';
  const nowRef = useRef<Date>(new Date());
  const {start, end} = getTimeRangeFromEvent(event, nowRef.current, timeWindow);
  const {elementRef, width: timelineWidth} = useDimensions<HTMLDivElement>();
  const elapsedMinutes = timeWindowConfig[timeWindow].elapsedMinutes;
  const rollup = Math.floor((elapsedMinutes * 60) / timelineWidth);

  const handleResolutionChange = useCallback(
    (value: TimeWindow) => {
      replace({...location, query: {...location.query, timeWindow: value}});
    },
    [location, replace]
  );

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;
  const {data: monitorStats, isLoading} = useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          until: Math.floor(end.getTime() / 1000),
          since: Math.floor(start.getTime() / 1000),
          monitor: monitorSlug,
          resolution: `${rollup}s`,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!monitorSlug && timelineWidth > 0,
    }
  );

  if (!monitorSlug) {
    return null;
  }

  return (
    <EventDataSection
      title={t('Check-ins')}
      type="check-ins"
      help={t('A timeline of check-ins that happened before and after this event')}
    >
      <ListFilters>
        <SegmentedControl<TimeWindow>
          value={timeWindow}
          onChange={handleResolutionChange}
          size="xs"
          aria-label={t('Time Scale')}
        >
          <SegmentedControl.Item key="1h">{t('Hour')}</SegmentedControl.Item>
          <SegmentedControl.Item key="24h">{t('Day')}</SegmentedControl.Item>
          <SegmentedControl.Item key="7d">{t('Week')}</SegmentedControl.Item>
          <SegmentedControl.Item key="30d">{t('Month')}</SegmentedControl.Item>
        </SegmentedControl>
      </ListFilters>
      <TimelineContainer>
        <TimelineWidthTracker ref={elementRef} />
        <StyledGridLineTimeLabels
          timeWindow={timeWindow}
          end={end}
          width={timelineWidth}
        />
        <StyledGridLineOverlay
          showCursor={!isLoading}
          timeWindow={timeWindow}
          end={end}
          width={timelineWidth}
        />
        {monitorStats && !isLoading ? (
          <CheckInTimeline
            width={timelineWidth}
            bucketedData={monitorStats[monitorSlug]}
            start={start}
            end={end}
            timeWindow={timeWindow}
            environment={environment ?? DEFAULT_ENVIRONMENT}
          />
        ) : (
          <Placeholder />
        )}
      </TimelineContainer>
    </EventDataSection>
  );
}

const ListFilters = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const TimelineContainer = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 40px 75px;
  align-items: center;
`;

const StyledGridLineTimeLabels = styled(GridLineTimeLabels)`
  grid-column: 0;
`;

const StyledGridLineOverlay = styled(GridLineOverlay)`
  grid-column: 0;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 0;
`;
