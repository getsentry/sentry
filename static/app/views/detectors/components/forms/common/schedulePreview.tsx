import {Fragment, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import type {
  CheckInBucket,
  TickStyle,
  TimeWindowConfig,
} from 'sentry/components/checkInTimeline/types';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import LoadingError from 'sentry/components/loadingError';
import {t, tn} from 'sentry/locale';
import {useDimensions} from 'sentry/utils/useDimensions';
import {
  SchedulePreviewStatus,
  useMonitorsScheduleSampleBuckets,
} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import {useMonitorsScheduleSampleWindow} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleWindow';
import type { ScheduleType } from 'sentry/views/insights/crons/types';
import { Alert } from '@sentry/scraps/alert';

type SchedulePreviewProps = {
    tickStyle: TickStyle<SchedulePreviewStatus>;
    statusToText: Record<SchedulePreviewStatus, string>;
    statusPrecedent: SchedulePreviewStatus[];
    scheduleType: ScheduleType;
    scheduleCrontab: string;
    scheduleIntervalValue: number;
    scheduleIntervalUnit: string;
    timezone: string;
    failureIssueThreshold: number;
    recoveryThreshold: number;
    sticky?: boolean;
};

export function SchedulePreview({
  scheduleType,
  scheduleCrontab,
  scheduleIntervalValue,
  scheduleIntervalUnit,
  timezone,
  failureIssueThreshold,
  recoveryThreshold,
  tickStyle,
  statusToText,
  statusPrecedent,
  sticky,
}: SchedulePreviewProps) {
  const {
    data: sampleWindowData,
    isLoading: isLoadingSampleWindow,
    error: errorSampleWindow,
  } = useMonitorsScheduleSampleWindow({
    scheduleType,
    scheduleCrontab,
    scheduleIntervalValue,
    scheduleIntervalUnit,
    timezone,
    failureIssueThreshold,
    recoveryThreshold,
  });

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const timeWindowConfig = sampleWindowData
    ? getConfigFromTimeRange(
        new Date(sampleWindowData.start * 1000),
        new Date(sampleWindowData.end * 1000),
        timelineWidth,
        'UTC'
      )
    : undefined;

  const start = timeWindowConfig?.start;
  const end = timeWindowConfig?.end;
  const interval = timeWindowConfig?.rollupConfig.interval;

  const {
    data: sampleBucketsData,
    isLoading: isLoadingSampleBuckets,
    error: errorSampleBuckets,
  } = useMonitorsScheduleSampleBuckets({
    scheduleType,
    scheduleCrontab,
    scheduleIntervalValue,
    scheduleIntervalUnit,
    timezone,
    failureIssueThreshold,
    recoveryThreshold,
    start: start ? start.getTime() / 1000 : undefined,
    end: end ? end.getTime() / 1000 : undefined,
    interval: interval ?? undefined,
  });

  if (errorSampleWindow || errorSampleBuckets) {
    if (errorSampleWindow?.status === 400) {
      const message = Object.values(errorSampleWindow.responseJSON ?? {}).join(', ');
      return <Alert variant="warning">{t('No schedule preview available: %s', message)}</Alert>;
    }

    return <LoadingError message={t('Failed to load schedule preview')} />;
  }

  const isLoading = isLoadingSampleWindow || isLoadingSampleBuckets;

  return (
    <Container sticky={sticky}>
      <TimelineWidthTracker ref={elementRef} />
      {isLoading ? (
        <TimeLineContainer>
          <CheckInPlaceholder />
        </TimeLineContainer>
      ) : timeWindowConfig && sampleBucketsData ? (
        <Fragment>
          <GridLineOverlay
            showCursor
            timeWindowConfig={timeWindowConfig}
          />
          <OpenPeriod
            failureThreshold={failureIssueThreshold}
            recoveryThreshold={recoveryThreshold}
            statusPrecedent={statusPrecedent}
            bucketedData={sampleBucketsData}
            timeWindowConfig={timeWindowConfig}
          />
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <TimeLineContainer>
            <CheckInTimeline<SchedulePreviewStatus>
              bucketedData={sampleBucketsData}
              timeWindowConfig={timeWindowConfig}
              statusLabel={statusToText}
              statusStyle={tickStyle}
              statusPrecedent={statusPrecedent}
            />
          </TimeLineContainer>
        </Fragment>
      ) : null}
    </Container>
  );
}

function OpenPeriod({
 failureThreshold,
 recoveryThreshold,
  statusPrecedent,
  bucketedData,
  timeWindowConfig,
}: {
  failureThreshold: number;
  recoveryThreshold: number;
  statusPrecedent: SchedulePreviewStatus[];
  bucketedData: Array<CheckInBucket<SchedulePreviewStatus>>;
  timeWindowConfig: TimeWindowConfig;
}) {
  const {bucketPixels, underscanStartOffset} = timeWindowConfig.rollupConfig;

  // Draw the open period from:
  // - the first ERROR bucket, to
  // - the first OK bucket after that.
  let openBarStartIdx: number | null = null;
  for (let i = 0; i < bucketedData.length; i++) {
    if (getBucketStatus(statusPrecedent, bucketedData[i]?.[1]) === SchedulePreviewStatus.ERROR) {
      openBarStartIdx = i;
      break;
    }
  }

  let openBarEndIdx: number | null = null;
  if (openBarStartIdx !== null) {
    for (let i = openBarStartIdx + 1; i < bucketedData.length; i++) {
      if (getBucketStatus(statusPrecedent, bucketedData[i]?.[1]) === SchedulePreviewStatus.OK) {
      openBarEndIdx = i;
      break;
      }
    }
  }

  if (
    openBarStartIdx === null ||
    openBarEndIdx === null ||
    openBarEndIdx <= openBarStartIdx
  ) {
    return null;
  }

  const left = openBarStartIdx * bucketPixels - underscanStartOffset;
  const right = openBarEndIdx * bucketPixels - underscanStartOffset;
  const width = right - left;

  if (width <= 0) {
    return null;
  }

  let subFailureCount = 0;
  let subRecoveryCount = 0;
  for (let i = 0; i < bucketedData.length; i++) {
    const stats = bucketedData[i]?.[1];
    if (!stats) {
      continue;
    }
    subFailureCount += stats[SchedulePreviewStatus.SUB_FAILURE_ERROR] ?? 0;
    subRecoveryCount += stats[SchedulePreviewStatus.SUB_RECOVERY_OK] ?? 0;
  }

  return (
    <Fragment>
      <OpenPeriodBar style={{left, width}}>
        <OpenPeriodLabel>{t('New Open Period')}</OpenPeriodLabel>
      </OpenPeriodBar>
      <OpenPeriodCountLabel style={{left}}>
        {failureThreshold} {tn('failed check-in', 'failed check-ins', failureThreshold)}
      </OpenPeriodCountLabel>
      <OpenPeriodCountLabel style={{left: right}}>
        {recoveryThreshold} {tn('success check-in', 'success check-ins', recoveryThreshold)}
      </OpenPeriodCountLabel>
    </Fragment>
  );
}

function getBucketStatus(statusPrecedent: SchedulePreviewStatus[], stats: Record<string, number> | undefined) {
    return stats ? statusPrecedent.find(status => (stats[status] ?? 0) > 0) : undefined;
}

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
`;

const TimeLineContainer = styled('div')`
  position: absolute;
  top: 50px;
  width: 100%;
`;

const OpenPeriodBar = styled('div')`
  position: absolute;
  top: 78px;
  height: 18px;
  background: ${p => p.theme.colors.red600};
  color: ${p => p.theme.white};
  display: flex;
  align-items: center;
  pointer-events: none;
  padding: 0 ${p => p.theme.space.md};
  overflow: visible;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: -8px;
    width: 2px;
    background: ${p => p.theme.colors.red600};
  }

  /* Start/end boundary markers */
  &::before {
    left: 0;
  }
  &::after {
    right: 0;
  }
`;

const OpenPeriodLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const OpenPeriodCountLabel = styled('div')`
  position: absolute;
  top: 108px;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
  transform: translateX(-50%);
  text-align: center;
`;

const Container = styled('div')<{sticky?: boolean}>`
  position: relative;
  width: 100%;
  height: 138px;

  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  ${p =>
    p.sticky &&
    css`
      position: sticky;
      top: 8px;
      z-index: 1;

      /*
       * Prevent seeing content beneath in the uncovered strip above the sticky element.
       * Use a solid, zero-blur shadow so we don't paint over the border.
       */
      box-shadow: 0 -8px 0 0 ${p.theme.tokens.background.primary};
    `}
`;
