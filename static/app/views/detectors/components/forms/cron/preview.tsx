import {Fragment, useRef} from 'react';
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
  PreviewStatus,
  useMonitorsScheduleSampleBuckets,
} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import {useMonitorsScheduleSampleWindow} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleWindow';

const tickStyle: TickStyle<PreviewStatus> = theme => ({
  [PreviewStatus.ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
  },
  [PreviewStatus.OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
  },
  [PreviewStatus.SUB_FAILURE_ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
    hatchTick: theme.colors.red200,
  },
  [PreviewStatus.SUB_RECOVERY_OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
    hatchTick: theme.colors.green200,
  },
});

const statusToText: Record<PreviewStatus, string> = {
  [PreviewStatus.OK]: t('Okay'),
  [PreviewStatus.ERROR]: t('Failed'),
  [PreviewStatus.SUB_FAILURE_ERROR]: t('Failed (Sub-Threshold)'),
  [PreviewStatus.SUB_RECOVERY_OK]: t('Okay (Sub-Threshold)'),
};

export const statusPrecedent: PreviewStatus[] = [
  PreviewStatus.SUB_FAILURE_ERROR,
  PreviewStatus.SUB_RECOVERY_OK,
  PreviewStatus.ERROR,
  PreviewStatus.OK,
];

export function Preview() {
  const {
    data: sampleWindowData,
    isLoading: isLoadingSampleWindow,
    isError: isErrorSampleWindow,
  } = useMonitorsScheduleSampleWindow();

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
    isError: isErrorSampleBuckets,
  } = useMonitorsScheduleSampleBuckets({
    start: start ? start.getTime() / 1000 : undefined,
    end: end ? end.getTime() / 1000 : undefined,
    interval: interval ?? undefined,
  });

  const isError = isErrorSampleWindow || isErrorSampleBuckets;
  const isLoading = isLoadingSampleWindow || isLoadingSampleBuckets;

  if (isError) {
    return <LoadingError message={t('Failed to load schedule preview')} />;
  }

  return (
    <Container>
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
            additionalUi={
              <OpenPeriod
                bucketedData={sampleBucketsData}
                timeWindowConfig={timeWindowConfig}
              />
            }
          />
          <OpenPeriod
            bucketedData={sampleBucketsData}
            timeWindowConfig={timeWindowConfig}
          />
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <TimeLineContainer>
            <CheckInTimeline<PreviewStatus>
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
  bucketedData,
  timeWindowConfig,
}: {
  bucketedData: Array<CheckInBucket<PreviewStatus>>;
  timeWindowConfig: TimeWindowConfig;
}) {
  const {bucketPixels, underscanStartOffset} = timeWindowConfig.rollupConfig;

  let lastSubFailureIdx: number | null = null;
  let lastSubRecoveryIdx: number | null = null;

  function getBucketStatus(stats?: Record<string, number>) {
    return stats ? statusPrecedent.find(status => (stats[status] ?? 0) > 0) : undefined;
  }

  for (let i = bucketedData.length - 1; i >= 0; i--) {
    const stats = bucketedData[i]?.[1];
    const status = getBucketStatus(stats);
    if (lastSubFailureIdx === null && status === PreviewStatus.SUB_FAILURE_ERROR) {
      lastSubFailureIdx = i;
    }
    if (lastSubRecoveryIdx === null && status === PreviewStatus.SUB_RECOVERY_OK) {
      lastSubRecoveryIdx = i;
    }
    if (lastSubFailureIdx !== null && lastSubRecoveryIdx !== null) {
      break;
    }
  }

  if (
    lastSubFailureIdx === null ||
    lastSubRecoveryIdx === null ||
    lastSubRecoveryIdx < lastSubFailureIdx
  ) {
    return null;
  }

  // We want to draw the open period from:
  // - the first ERROR bucket after the (sub-threshold) failure buckets, to
  // - the first OK bucket after the (sub-threshold) recovery buckets.
  let openBarStartIdx: number | null = null;
  for (let i = lastSubFailureIdx + 1; i < bucketedData.length; i++) {
    const status = getBucketStatus(bucketedData[i]?.[1]);
    if (status === PreviewStatus.ERROR) {
      openBarStartIdx = i;
      break;
    }
  }

  let openBarEndIdx: number | null = null;
  for (let i = lastSubRecoveryIdx + 1; i < bucketedData.length; i++) {
    const status = getBucketStatus(bucketedData[i]?.[1]);
    if (status === PreviewStatus.OK) {
      openBarEndIdx = i;
      break;
    }
  }

  if (
    openBarStartIdx === null ||
    openBarEndIdx === null ||
    openBarEndIdx <= openBarStartIdx
  ) {
    return null;
  }

  // openBarEndIdx is the first OK bucket after recovery, so end at its start boundary.
  const left = openBarStartIdx * bucketPixels - underscanStartOffset;
  const right = openBarEndIdx * bucketPixels - underscanStartOffset;
  const width = right - left;

  if (width <= 0) {
    return null;
  }

  let failureCount = 0;
  let successCount = 0;
  for (let i = 0; i < bucketedData.length; i++) {
    const stats = bucketedData[i]?.[1];
    if (!stats) {
      continue;
    }
    failureCount += stats[PreviewStatus.SUB_FAILURE_ERROR] ?? 0;
    successCount += stats[PreviewStatus.SUB_RECOVERY_OK] ?? 0;
  }

  return (
    <Fragment>
      <OpenPeriodBar style={{left, width}}>
        <OpenPeriodLabel>{t('New Open Period')}</OpenPeriodLabel>
      </OpenPeriodBar>
      <OpenPeriodCountLabel style={{left}}>
        {failureCount + 1} {tn('failed check-in', 'failed check-ins', failureCount)}
      </OpenPeriodCountLabel>
      <OpenPeriodCountLabel style={{left: right}}>
        {successCount + 1} {tn('success check-in', 'success check-ins', successCount)}
      </OpenPeriodCountLabel>
    </Fragment>
  );
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

const Container = styled('div')`
  position: relative;
  width: 100%;
  height: 138px;
  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  margin-bottom: ${p => p.theme.space.lg};
`;
