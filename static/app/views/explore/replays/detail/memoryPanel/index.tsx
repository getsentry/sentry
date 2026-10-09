import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Grid as ScrapsGrid} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useCurrentHoverTime} from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {MemoryChart} from 'sentry/views/explore/replays/detail/memoryPanel/memoryChart';
import {NoRowRenderer} from 'sentry/views/explore/replays/detail/noRowRenderer';

export function MemoryPanel() {
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
    <ScrapsGrid justify="center" gap="md" height="100%" columns="1fr" rows="1fr 1fr">
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
    </ScrapsGrid>
  );
}

const ChartWrapper = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.md};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  & > * {
    flex-grow: 1;
  }
`;

const ChartTitle = styled('h5')`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
  flex: 0 1 auto;
  margin: 0;
`;

const Description = styled('p')`
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
`;
