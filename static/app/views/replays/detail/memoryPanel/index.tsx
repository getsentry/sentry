import {Fragment} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import MemoryChart from 'sentry/views/replays/detail/memoryPanel/memoryChart';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';

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
      <ChartWrapper data-test-id="replay-details-memory-tab">
        <NoRowRenderer unfilteredItems={[]} clearSearchTerm={() => {}}>
          <Fragment>
            <p>{t('No memory metrics found')}</p>
            <Description>
              {t(
                'Memory metrics are only captured within Chromium based browser sessions.'
              )}
            </Description>
          </Fragment>
        </NoRowRenderer>
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
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${space(0.5)};
  padding: ${space(1)};
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

const Description = styled('p')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
`;
