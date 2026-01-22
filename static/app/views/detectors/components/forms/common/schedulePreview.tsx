import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Container} from '@sentry/scraps/layout/container';

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
import LoadingError from 'sentry/components/loadingError';
import {t, tn} from 'sentry/locale';
import type RequestError from 'sentry/utils/requestError/requestError';
import {SchedulePreviewStatus} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import {
  useMonitorsScheduleSamples,
  type UseMonitorsScheduleSamplesOptions,
} from 'sentry/views/detectors/hooks/useMonitorsScheduleSamples';

interface SchedulePreviewProps extends UseMonitorsScheduleSamplesOptions {
  statusToText: Record<SchedulePreviewStatus, string>;
}

const statusPrecedent: SchedulePreviewStatus[] = [
  SchedulePreviewStatus.SUB_FAILURE_ERROR,
  SchedulePreviewStatus.SUB_RECOVERY_OK,
  SchedulePreviewStatus.ERROR,
  SchedulePreviewStatus.OK,
];

const tickStyle: TickStyle<SchedulePreviewStatus> = theme => ({
  [SchedulePreviewStatus.ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
  },
  [SchedulePreviewStatus.OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
  },
  [SchedulePreviewStatus.SUB_FAILURE_ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
    hatchTick: theme.colors.red200,
  },
  [SchedulePreviewStatus.SUB_RECOVERY_OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
    hatchTick: theme.colors.green200,
  },
});

export function SchedulePreview({statusToText, ...detectorFields}: SchedulePreviewProps) {
  const {timeLineWidthTrackerRef, timeWindowConfig, samples, isLoading, errors} =
    useMonitorsScheduleSamples(detectorFields);

  if (errors.length > 0) {
    const badRequestError = errors.find(
      (error): error is RequestError => error?.status === 400
    );

    const message = badRequestError ? (
      <Alert variant="warning">
        {t(
          'No preview available. The provided schedule is invalid, or the thresholds are incompatible with it.'
        )}
      </Alert>
    ) : (
      <LoadingError message={t('Failed to load schedule preview')} />
    );

    return (
      <ContentWrapper timelineWidthTrackerRef={timeLineWidthTrackerRef}>
        <ErrorContainer position="absolute" width="fit-content" top="50%" left="50%">
          {message}
        </ErrorContainer>
      </ContentWrapper>
    );
  }

  return (
    <ContentWrapper timelineWidthTrackerRef={timeLineWidthTrackerRef}>
      {isLoading ? (
        <Container position="absolute" width="100%" top="50px">
          <CheckInPlaceholder />
        </Container>
      ) : timeWindowConfig && samples ? (
        <Fragment>
          <GridLineOverlay showCursor timeWindowConfig={timeWindowConfig} />
          <OpenPeriod
            failureThreshold={detectorFields.failureIssueThreshold}
            recoveryThreshold={detectorFields.recoveryThreshold}
            bucketedData={samples}
            timeWindowConfig={timeWindowConfig}
          />
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <Container position="absolute" width="100%" top="50px">
            <CheckInTimeline<SchedulePreviewStatus>
              bucketedData={samples}
              timeWindowConfig={timeWindowConfig}
              statusLabel={statusToText}
              statusStyle={tickStyle}
              statusPrecedent={statusPrecedent}
              tooltipProps={{maxWidth: 500}}
            />
          </Container>
        </Fragment>
      ) : null}
    </ContentWrapper>
  );
}

function OpenPeriod({
  failureThreshold,
  recoveryThreshold,
  bucketedData,
  timeWindowConfig,
}: {
  bucketedData: Array<CheckInBucket<SchedulePreviewStatus>>;
  failureThreshold: number;
  recoveryThreshold: number;
  timeWindowConfig: TimeWindowConfig;
}) {
  const {bucketPixels, underscanStartOffset} = timeWindowConfig.rollupConfig;

  // Draw the open period from:
  // - the first ERROR bucket, to
  // - the first OK bucket after that.
  const openBarStartIdx = bucketedData.findIndex(
    bucket => getBucketStatus(bucket?.[1]) === SchedulePreviewStatus.ERROR
  );

  if (openBarStartIdx === -1) {
    return null;
  }

  const okAfterStartIdx = bucketedData
    .slice(openBarStartIdx + 1)
    .findIndex(bucket => getBucketStatus(bucket?.[1]) === SchedulePreviewStatus.OK);
  const openBarEndIdx =
    okAfterStartIdx === -1 ? -1 : openBarStartIdx + 1 + okAfterStartIdx;

  if (openBarEndIdx === -1) {
    return null;
  }

  const left = openBarStartIdx * bucketPixels - underscanStartOffset;
  const right = openBarEndIdx * bucketPixels - underscanStartOffset;
  const width = right - left;

  return (
    <Fragment>
      <OpenPeriodBar style={{left, width}}>
        <OpenPeriodLabel>{t('Issue Open Period')}</OpenPeriodLabel>
      </OpenPeriodBar>
      <OpenPeriodCountLabel style={{left}}>
        {failureThreshold} {tn('failed check-in', 'failed check-ins', failureThreshold)}
      </OpenPeriodCountLabel>
      <OpenPeriodCountLabel style={{left: right}}>
        {recoveryThreshold}{' '}
        {tn('success check-in', 'success check-ins', recoveryThreshold)}
      </OpenPeriodCountLabel>
    </Fragment>
  );
}

function ContentWrapper({
  children,
  timelineWidthTrackerRef,
}: {
  children: React.ReactNode;
  timelineWidthTrackerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <StyledContainer
      position="sticky"
      width="100%"
      height="138px"
      background="primary"
      border="primary"
      radius="md"
    >
      <Container position="absolute" width="100%" ref={timelineWidthTrackerRef} />
      {children}
    </StyledContainer>
  );
}

function getBucketStatus(stats: Record<string, number> | undefined) {
  return stats ? statusPrecedent.find(status => (stats[status] ?? 0) > 0) : undefined;
}

const OpenPeriodBar = styled('div')`
  position: absolute;
  top: 78px;
  height: 18px;
  background: ${p => p.theme.colors.red400};
  color: ${p => p.theme.colors.white};
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
    background: ${p => p.theme.colors.red400};
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
  line-height: 1.4;
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

const StyledContainer = styled(Container)`
  top: 8px;
  z-index: ${p => p.theme.zIndex.monitorCreationForms.schedulePreview};
  /*
    * Prevent seeing content beneath in the uncovered strip above the sticky element.
    * Use a solid, zero-blur shadow so we don't paint over the border.
    */
  box-shadow: 0 -8px 0 0 ${p => p.theme.tokens.background.primary};
`;

const ErrorContainer = styled(Container)`
  transform: translate(-50%, -50%);
  font-size: ${p => p.theme.fontSize.lg};
`;
