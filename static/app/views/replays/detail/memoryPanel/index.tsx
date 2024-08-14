import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useCountDomNodes from 'sentry/utils/replays/hooks/useCountDomNodes';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import DomNodesChart from 'sentry/views/replays/detail/memoryPanel/domNodesChart';
import MemoryChart from 'sentry/views/replays/detail/memoryPanel/memoryChart';

export default function MemoryPanel() {
  const {currentTime, isFetching, replay, setCurrentTime} = useReplayContext();
  const [currentHoverTime, setCurrentHoverTime] = useCurrentHoverTime();

  const memoryFrames = replay?.getMemoryFrames();

  const {data: frameToCount, isLoading: isDomNodeDataLoading} = useCountDomNodes({
    replay,
  });
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
      <Fragment>
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
      </Fragment>
    );

  const domNodesChart =
    !replay || isDomNodeDataLoading ? (
      <Placeholder height="100%" />
    ) : (
      <Fragment>
        <ChartTitle>{t('DOM Nodes')}</ChartTitle>
        <DomNodesChart
          currentHoverTime={currentHoverTime}
          currentTime={currentTime}
          durationMs={replay.getDurationMs()}
          datapoints={domNodeData}
          setCurrentHoverTime={setCurrentHoverTime}
          setCurrentTime={setCurrentTime}
          startTimestampMs={replay.getStartTimestampMs()}
        />
      </Fragment>
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
  flex-direction: column;
  & > * {
    flex-grow: 1;
  }
`;

const ChartTitle = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.text.cardTitle.fontWeight};
  line-height: ${p => p.theme.text.cardTitle.lineHeight};
  color: ${p => p.theme.subText};
  flex: 0 1 auto;
  margin: 0;
`;
