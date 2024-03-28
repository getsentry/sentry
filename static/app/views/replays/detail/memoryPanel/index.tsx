import {useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useQuery} from 'sentry/utils/queryClient';
import countDomNodes from 'sentry/utils/replays/countDomNodes';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import DomNodesChart from 'sentry/views/replays/detail/memoryPanel/domNodesChart';
import MemoryChart from 'sentry/views/replays/detail/memoryPanel/memoryChart';

function useCountDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['countDomNodes', replay],
    () =>
      countDomNodes({
        frames: replay?.getRRWebMutations(),
        rrwebEvents: replay?.getRRWebFrames(),
        startTimestampMs: replay?.getStartTimestampMs() ?? 0,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}

export default function MemoryPanel() {
  const {
    currentTime,
    currentHoverTime,
    isFetching,
    replay,
    setCurrentHoverTime,
    setCurrentTime,
  } = useReplayContext();

  const memoryFrames = replay?.getMemoryFrames();

  const {data: frameToCount} = useCountDomNodes({replay});
  const domNodeData = useMemo(
    () => Array.from(frameToCount?.values() || []),
    [frameToCount]
  );

  const memoryChart =
    !replay || isFetching ? (
      <Placeholder height="100%" />
    ) : !replay || !memoryFrames?.length ? (
      <EmptyMessage
        data-test-id="replay-details-memory-tab"
        title={t('No memory metrics found')}
        description={t(
          'Memory metrics are only captured within Chromium based browser sessions.'
        )}
      />
    ) : (
      <MemoryChart
        currentHoverTime={currentHoverTime}
        currentTime={currentTime}
        durationMs={replay.getDurationMs()}
        memoryFrames={memoryFrames}
        setCurrentHoverTime={setCurrentHoverTime}
        setCurrentTime={setCurrentTime}
        startOffsetMs={replay.getStartOffsetMs()}
      />
    );

  const domNodesChart =
    !replay || isFetching ? (
      <Placeholder height="100%" />
    ) : (
      <DomNodesChart
        currentHoverTime={currentHoverTime}
        currentTime={currentTime}
        durationMs={replay.getDurationMs()}
        datapoints={domNodeData}
        setCurrentHoverTime={setCurrentHoverTime}
        setCurrentTime={setCurrentTime}
        startOffsetMs={replay.getStartOffsetMs()}
        startTimestampMs={replay.getStartTimestampMs()}
      />
    );

  return (
    <Grid>
      <ChartWrapper>{memoryChart}</ChartWrapper>
      <ChartWrapper>{domNodesChart}</ChartWrapper>
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
  & > * {
    flex-grow: 1;
  }
`;
