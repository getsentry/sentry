import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import type {TickStyle} from 'sentry/components/checkInTimeline/types';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
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
          <GridLineOverlay showCursor timeWindowConfig={timeWindowConfig} />
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

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
`;

const TimeLineContainer = styled('div')`
  position: absolute;
  top: 46px;
  width: 100%;
`;

const Container = styled('div')`
  position: relative;
  width: 100%;
  height: 100px;
  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  margin-bottom: ${p => p.theme.space.lg};
`;
