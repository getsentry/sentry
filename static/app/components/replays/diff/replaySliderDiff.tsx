import {Fragment, useCallback, useRef, type CSSProperties} from 'react';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import {After, Before} from 'sentry/components/replays/diff/utils';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  minHeight?: CSSProperties['minHeight'];
}

export function ReplaySliderDiff({minHeight}: Props) {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();
  const organization = useOrganization();
  const dividerClickedRef = useRef(false); // once set, never flips back to false

  const onDragHandleMouseDownWithAnalytics = useCallback(() => {
    // tracks only the first mouseDown since the last render
    if (organization && !dividerClickedRef.current) {
      trackAnalytics('replay.hydration-modal.slider-interaction', {organization});
      dividerClickedRef.current = true;
    }
  }, [organization]);

  return (
    <Fragment>
      <ContentSliderDiff.Header>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs} />
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs} />
      </ContentSliderDiff.Header>
      <ReplayPlayerPluginsContextProvider>
        <ReplayReaderProvider replay={replay}>
          <ContentSliderDiff.Body
            onDragHandleMouseDown={onDragHandleMouseDownWithAnalytics}
            minHeight={minHeight}
            before={
              <ReplayPlayerStateContextProvider>
                <ReplayPlayerMeasurer>
                  {style => <ReplayPlayer style={style} offsetMs={leftOffsetMs} />}
                </ReplayPlayerMeasurer>
              </ReplayPlayerStateContextProvider>
            }
            after={
              <ReplayPlayerStateContextProvider>
                <ReplayPlayerMeasurer>
                  {style => <ReplayPlayer style={style} offsetMs={rightOffsetMs} />}
                </ReplayPlayerMeasurer>
              </ReplayPlayerStateContextProvider>
            }
          />
        </ReplayReaderProvider>
      </ReplayPlayerPluginsContextProvider>
    </Fragment>
  );
}
