import {Fragment, useContext, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {MockCheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import FormContext from 'sentry/components/forms/formContext';
import type {FieldValue} from 'sentry/components/forms/model';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {CheckInStatus, ScheduleType} from 'sentry/views/monitors/types';

import {checkInStatusPrecedent, statusToText, tickStyle} from '../utils';

interface ScheduleConfig {
  cronSchedule?: FieldValue;
  intervalFrequency?: FieldValue;
  intervalUnit?: FieldValue;
  scheduleType?: FieldValue;
  timezone?: FieldValue;
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
  const {scheduleType, cronSchedule, timezone, intervalFrequency, intervalUnit} =
    schedule;

  const organization = useOrganization();
  const {form} = useContext(FormContext);

  const query = {
    num_ticks: NUM_SAMPLE_TICKS,
    schedule_type: scheduleType,
    timezone,
    schedule:
      scheduleType === 'interval' ? [intervalFrequency, intervalUnit] : cronSchedule,
  };

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const sampleDataQueryKey = [
    `/organizations/${organization.slug}/monitors-schedule-data/`,
    {query},
  ] as const;
  const {data, isPending, isError, error} = useApiQuery<number[]>(sampleDataQueryKey, {
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
      {isPending || !start || !end || !timeWindowConfig || !mockTimestamps ? (
        <Fragment>
          <Placeholder height="50px" />
          {errorMessage ? null : <CheckInPlaceholder />}
        </Fragment>
      ) : (
        <Fragment>
          <AlignedGridLineLabels timeWindowConfig={timeWindowConfig} />
          <AlignedGridLineOverlay
            showCursor={!isPending}
            timeWindowConfig={timeWindowConfig}
          />
          <MockCheckInTimeline
            mockTimestamps={mockTimestamps.slice(1, mockTimestamps.length - 1)}
            status={CheckInStatus.IN_PROGRESS}
            statusStyle={tickStyle}
            statusLabel={statusToText}
            statusPrecedent={checkInStatusPrecedent}
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
  grid-template-rows: auto 60px;
  align-items: center;
`;

const AlignedGridLineLabels = styled(GridLineLabels)`
  grid-column: 0;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const AlignedGridLineOverlay = styled(GridLineOverlay)`
  grid-column: 0;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 0;
`;
