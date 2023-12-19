import {Fragment, useContext, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import FormContext from 'sentry/components/forms/formContext';
import {FieldValue} from 'sentry/components/forms/model';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {MockCheckInTimeline} from 'sentry/views/monitors/components/overviewTimeline/checkInTimeline';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/gridLines';
import {TimelinePlaceholder} from 'sentry/views/monitors/components/overviewTimeline/timelinePlaceholder';
import {getConfigFromTimeRange} from 'sentry/views/monitors/components/overviewTimeline/utils';
import {ScheduleType} from 'sentry/views/monitors/types';

interface ScheduleConfig {
  cronSchedule?: FieldValue;
  intervalFrequency?: FieldValue;
  intervalUnit?: FieldValue;
  scheduleType?: FieldValue;
}

const NUM_SAMPLE_TICKS = 9;

function isValidConfig(schedule: ScheduleConfig) {
  const {scheduleType, cronSchedule, intervalFrequency, intervalUnit} = schedule;
  return !!(
    (scheduleType === ScheduleType.CRONTAB && cronSchedule) ||
    (scheduleType === ScheduleType.INTERVAL && intervalFrequency && intervalUnit)
  );
}

interface Props {
  schedule: ScheduleConfig;
}

export function MockTimelineVisualization({schedule}: Props) {
  const {scheduleType, cronSchedule, intervalFrequency, intervalUnit} = schedule;
  const organization = useOrganization();
  const {form} = useContext(FormContext);

  const query = {
    num_ticks: NUM_SAMPLE_TICKS,
    schedule_type: scheduleType,
    schedule:
      scheduleType === 'interval' ? [intervalFrequency, intervalUnit] : cronSchedule,
  };

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const sampleDataQueryKey = [
    `/organizations/${organization.slug}/monitors-schedule-data/`,
    {query},
  ] as const;
  const {data, isLoading, isError, error} = useApiQuery<number[]>(sampleDataQueryKey, {
    staleTime: 0,
    enabled: isValidConfig(schedule),
    retry: false,
  });

  const errorMessage =
    isError || !isValidConfig(schedule)
      ? error?.responseJSON?.schedule?.[0] ?? t('Invalid Schedule')
      : null;

  useEffect(() => {
    if (!form) {
      return;
    }

    if (scheduleType === ScheduleType.INTERVAL) {
      form.setError('config.schedule.frequency', errorMessage);
    } else if (scheduleType === ScheduleType.CRONTAB) {
      form.setError('config.schedule', errorMessage);
    }
  }, [errorMessage, form, scheduleType]);

  const mockTimestamps = data?.map(ts => new Date(ts * 1000));
  const start = mockTimestamps?.[0];
  const end = mockTimestamps?.[mockTimestamps.length - 1];
  const timeWindowConfig =
    start && end ? getConfigFromTimeRange(start, end, timelineWidth) : undefined;

  return (
    <TimelineContainer>
      <TimelineWidthTracker ref={elementRef} />
      {isLoading || !start || !end || !timeWindowConfig || !mockTimestamps ? (
        <Fragment>
          <Placeholder height="40px" />
          {errorMessage ? (
            <Placeholder testId="error-placeholder" height="100px" />
          ) : (
            <TimelinePlaceholder />
          )}
        </Fragment>
      ) : (
        <Fragment>
          <StyledGridLineTimeLabels
            timeWindowConfig={timeWindowConfig}
            start={start}
            end={end}
            width={timelineWidth}
          />
          <StyledGridLineOverlay
            showCursor={!isLoading}
            timeWindowConfig={timeWindowConfig}
            start={start}
            end={end}
            width={timelineWidth}
          />
          <MockCheckInTimeline
            width={timelineWidth}
            mockTimestamps={mockTimestamps.slice(1, mockTimestamps.length - 1)}
            start={start}
            end={end}
            timeWindowConfig={timeWindowConfig}
          />
        </Fragment>
      )}
    </TimelineContainer>
  );
}

const TimelineContainer = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 40px 100px;
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
