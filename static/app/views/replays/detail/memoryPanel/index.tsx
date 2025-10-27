import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import EmptyState from 'sentry/views/replays/detail/emptyState';
import MemoryChart from 'sentry/views/replays/detail/memoryPanel/memoryChart';

export default function MemoryPanel() {
  const replay = useReplayReader();
  const {currentTime, isFetching, setCurrentTime} = useReplayContext();
  const [currentHoverTime, setCurrentHoverTime] = useCurrentHoverTime();

  const memoryFrames = replay?.getMemoryFrames();

  if (!replay || isFetching) {
    return (
      <ChartWrapper>
        <Placeholder height="100%" />
      </ChartWrapper>
    );
  }

  if (!memoryFrames?.length) {
    return (
      <ChartWrapper>
        <EmptyState data-test-id="replay-details-memory-tab">
          <p>
            <strong>{t('No memory metrics found')}</strong>
          </p>
          <p>
            {t(
              'Memory metrics are only captured within Chromium based browser sessions.'
            )}
          </p>
        </EmptyState>
      </ChartWrapper>
    );
  }

  return (
    <Grid>
      <ChartWrapper>
        <ChartTitle>{t('Heap Size')}</ChartTitle>
        <MemoryChart
          currentHoverTime={currentHoverTime}
          currentTime={currentTime}
          durationMs={replay.getDurationMs()}
          memoryFrames={memoryFrames}
          setCurrentHoverTime={setCurrentHoverTime}
          setCurrentTime={setCurrentTime}
          startTimestampMs={replay.getStartTimestampMs()}
        />
      </ChartWrapper>
    </Grid>
  );
}

const Grid = styled('div')`
  display: grid;
  grid-template-rows: 1fr 1fr;
  grid-template-columns: 1fr;
  gap: ${space(1)};
  justify-content: center;
  height: 100%;
`;

const ChartWrapper = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${space(0.5)};
  padding: ${space(1)};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  & > * {
    flex-grow: 1;
  }
`;

const ChartTitle = styled('h5')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
  flex: 0 1 auto;
  margin: 0;
`;
