import {Fragment, useContext, useEffect, useMemo, useRef} from 'react';
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
import {useTimezone} from 'sentry/components/timezoneProvider';
import {t, tn} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {CheckInStatus, ScheduleType} from 'sentry/views/insights/crons/types';
import {
  checkInStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/crons/utils';

interface ScheduleConfig {
  cronSchedule?: FieldValue;
  intervalFrequency?: FieldValue;
  intervalUnit?: FieldValue;
  scheduleType?: FieldValue;
  timezone?: string;
}

const DEFAULT_FAILURE_TOLERANCE = 2;
const DEFAULT_RECOVERY_THRESHOLD = 3;
const IN_PROGRESS_PADDING_TICKS = 2;
const OPEN_PERIOD_PADDING_TICKS = 6;
const MIN_SAMPLE_TICKS = 11;
const MAX_SAMPLE_TICKS = 100;

function toPositiveInt(value: FieldValue | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.floor(value);
    return rounded > 0 ? rounded : undefined;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isValidConfig(schedule: ScheduleConfig) {
  const {scheduleType, cronSchedule, intervalFrequency, intervalUnit} = schedule;
  return !!(
    (scheduleType === ScheduleType.CRONTAB && cronSchedule) ||
    (scheduleType === ScheduleType.INTERVAL && intervalFrequency && intervalUnit)
  );
}

interface Props {
  schedule: ScheduleConfig;
  failureTolerance?: FieldValue;
  recoveryThreshold?: FieldValue;
}

export function MockTimelineVisualization({
  schedule,
  failureTolerance,
  recoveryThreshold,
}: Props) {
  const {scheduleType, cronSchedule, timezone, intervalFrequency, intervalUnit} =
    schedule;

  const organization = useOrganization();
  const {form} = useContext(FormContext);

  const failureIssueThreshold =
    toPositiveInt(failureTolerance) ?? DEFAULT_FAILURE_TOLERANCE;
  const resolvedAfter = toPositiveInt(recoveryThreshold) ?? DEFAULT_RECOVERY_THRESHOLD;

  const numSampleTicks = useMemo(() => {
    // We request enough ticks to show:
    // - a few in-progress ticks before/after failures and recovery
    // - consecutive failing check-ins to trigger an issue
    // - an open period spanning some additional time
    // - consecutive successful check-ins to resolve
    const ticks =
      IN_PROGRESS_PADDING_TICKS +
      failureIssueThreshold +
      OPEN_PERIOD_PADDING_TICKS +
      resolvedAfter +
      IN_PROGRESS_PADDING_TICKS +
      1;
    return clampInt(ticks, MIN_SAMPLE_TICKS, MAX_SAMPLE_TICKS);
  }, [failureIssueThreshold, resolvedAfter]);

  const query = {
    num_ticks: numSampleTicks,
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
      ? // @ts-expect-error TS(2571): Object is of type 'unknown'.
        (error?.responseJSON?.schedule?.[0] ?? t('Invalid Schedule'))
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

  const userTimezone = useTimezone();
  const selectedTimezone = timezone ?? userTimezone;

  const mockTimestamps = data?.map(ts => new Date(ts * 1000));
  const start = mockTimestamps?.[0];
  const end = mockTimestamps?.[mockTimestamps.length - 1];
  const timeWindowConfig =
    start && end
      ? getConfigFromTimeRange(start, end, timelineWidth, selectedTimezone)
      : undefined;

  console.log(timeWindowConfig);

  const mockStatuses = useMemo(() => {
    if (!mockTimestamps?.length) {
      return undefined;
    }
    const n = mockTimestamps.length;
    const inProgressStart = Math.min(IN_PROGRESS_PADDING_TICKS, n);
    const failureCount = Math.min(
      failureIssueThreshold,
      Math.max(0, n - inProgressStart)
    );
    const openPeriodCount = Math.min(
      OPEN_PERIOD_PADDING_TICKS,
      Math.max(0, n - inProgressStart - failureCount)
    );
    const successCount = Math.min(
      resolvedAfter,
      Math.max(0, n - inProgressStart - failureCount - openPeriodCount)
    );

    return mockTimestamps.map((_, index) => {
      if (index < inProgressStart) {
        return CheckInStatus.IN_PROGRESS;
      }
      if (index < inProgressStart + failureCount) {
        return CheckInStatus.ERROR;
      }
      if (index < inProgressStart + failureCount + openPeriodCount) {
        // During an open issue period, check-ins remain failed until recovery occurs.
        return CheckInStatus.ERROR;
      }
      if (index < inProgressStart + failureCount + openPeriodCount + successCount) {
        return CheckInStatus.OK;
      }
      return CheckInStatus.IN_PROGRESS;
    });
  }, [failureIssueThreshold, mockTimestamps, resolvedAfter]);

  const labelCenters = useMemo(() => {
    if (!mockTimestamps?.length || !timeWindowConfig) {
      return null;
    }

    const n = mockTimestamps.length;
    const inProgressStart = Math.min(IN_PROGRESS_PADDING_TICKS, n);
    const failureCount = Math.min(
      failureIssueThreshold,
      Math.max(0, n - inProgressStart)
    );
    const openPeriodCount = Math.min(
      OPEN_PERIOD_PADDING_TICKS,
      Math.max(0, n - inProgressStart - failureCount)
    );
    const successCount = Math.min(
      resolvedAfter,
      Math.max(0, n - inProgressStart - failureCount - openPeriodCount)
    );

    const msPerPixel =
      (timeWindowConfig.elapsedMinutes * 60 * 1000) / timeWindowConfig.timelineWidth;
    const startOffset = timeWindowConfig.rollupConfig.timelineUnderscanWidth;
    const positionFromDate = (date: Date) =>
      startOffset +
      (date.getTime() - timeWindowConfig.periodStart.getTime()) / msPerPixel;

    // `timelineWidth` excludes the underscan area, but our tick positions include it
    // via `timelineUnderscanWidth` offset. Clamp to the full drawable width so
    // centers remain accurate for large thresholds near the right edge.
    const maxX =
      timeWindowConfig.timelineWidth +
      timeWindowConfig.rollupConfig.timelineUnderscanWidth;
    const clampX = (x: number) => Math.max(0, Math.min(maxX, Math.floor(x)));

    const failureStartIndex = inProgressStart;
    const failureEndIndex = Math.min(
      inProgressStart + Math.max(0, failureCount - 1),
      n - 1
    );
    const failureCenter =
      failureCount > 0
        ? clampX(
            (positionFromDate(mockTimestamps[failureStartIndex]!) +
              positionFromDate(mockTimestamps[failureEndIndex]!)) /
              2
          )
        : null;

    const successStartIndex = inProgressStart + failureCount + openPeriodCount;
    const successEndIndex = Math.min(
      successStartIndex + Math.max(0, successCount - 1),
      n - 1
    );
    const successCenter =
      successCount > 0
        ? clampX(
            (positionFromDate(mockTimestamps[successStartIndex]!) +
              positionFromDate(mockTimestamps[successEndIndex]!)) /
              2
          )
        : null;

    return {failureCenter, successCenter};
  }, [failureIssueThreshold, mockTimestamps, resolvedAfter, timeWindowConfig]);

  const openPeriodRange = useMemo(() => {
    if (!mockTimestamps?.length || !timeWindowConfig) {
      return null;
    }
    const n = mockTimestamps.length;
    if (failureIssueThreshold <= 0 || resolvedAfter <= 0 || n < 2) {
      return null;
    }

    // Issue opens once the failure threshold is reached.
    const openStartIndex = Math.min(
      Math.max(0, IN_PROGRESS_PADDING_TICKS + failureIssueThreshold - 1),
      n - 1
    );
    // Resolve once the recovery threshold is met (we model this as the last OK tick).
    const openEndIndex = Math.min(
      Math.max(
        openStartIndex,
        IN_PROGRESS_PADDING_TICKS +
          failureIssueThreshold +
          OPEN_PERIOD_PADDING_TICKS +
          resolvedAfter -
          1
      ),
      n - 1
    );

    const msPerPixel =
      (timeWindowConfig.elapsedMinutes * 60 * 1000) / timeWindowConfig.timelineWidth;
    const startOffset = timeWindowConfig.rollupConfig.timelineUnderscanWidth;
    const positionFromDate = (date: Date) =>
      startOffset +
      (date.getTime() - timeWindowConfig.periodStart.getTime()) / msPerPixel;

    const left = positionFromDate(mockTimestamps[openStartIndex]!);
    const right = positionFromDate(mockTimestamps[openEndIndex]!);

    return {
      left: Math.max(0, left),
      width: Math.max(0, right - left),
    };
  }, [failureIssueThreshold, mockTimestamps, resolvedAfter, timeWindowConfig]);

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
          <TimelinePlotArea>
            <AlignedGridLineOverlay
              showCursor={!isPending}
              timeWindowConfig={timeWindowConfig}
            />
            <TicksRow>
              <MockCheckInTimeline
                mockTimestamps={mockTimestamps}
                status={CheckInStatus.OK}
                statuses={mockStatuses}
                statusStyle={tickStyle}
                statusLabel={statusToText}
                statusPrecedent={checkInStatusPrecedent}
                timeWindowConfig={timeWindowConfig}
              />
            </TicksRow>
            {openPeriodRange && openPeriodRange.width > 0 ? (
              <OpenPeriodBar
                style={{left: openPeriodRange.left, width: openPeriodRange.width}}
              >
                {t('Issue Open Period')}
              </OpenPeriodBar>
            ) : null}
          </TimelinePlotArea>
          <CountsRow>
            {labelCenters?.failureCenter === null ? null : (
              <CountLabel style={{left: labelCenters?.failureCenter}}>
                {tn('%s failed check-in', '%s failed check-ins', failureIssueThreshold)}
              </CountLabel>
            )}
            {labelCenters?.successCenter === null ? null : (
              <CountLabel style={{left: labelCenters?.successCenter}}>
                {tn('%s success check-in', '%s success check-ins', resolvedAfter)}
              </CountLabel>
            )}
          </CountsRow>
        </Fragment>
      )}
    </TimelineContainer>
  );
}

const TimelineContainer = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto 60px auto;
  align-items: center;
`;

const AlignedGridLineLabels = styled(GridLineLabels)`
  grid-column: 0;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const TimelinePlotArea = styled('div')`
  grid-column: 0;
  position: relative;
  height: 60px;
`;

const AlignedGridLineOverlay = styled(GridLineOverlay)`
  position: absolute;
  inset: 0;
`;

const TICKS_TOP_PADDING = 12;
const OPEN_PERIOD_BOTTOM_PADDING = 6;

const TicksRow = styled('div')`
  position: absolute;
  inset-inline: 0;
  top: ${TICKS_TOP_PADDING}px;
`;

const OpenPeriodBar = styled('div')`
  position: absolute;
  bottom: ${OPEN_PERIOD_BOTTOM_PADDING}px;
  height: 18px;
  border-radius: 4px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.white};
  background: ${p => p.theme.red300};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const CountsRow = styled('div')`
  grid-column: 0;
  position: relative;
  height: 32px;
  border-top: 1px solid ${p => p.theme.border};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const CountLabel = styled('span')`
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 0;
`;
