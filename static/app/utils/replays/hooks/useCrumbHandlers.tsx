import {useCallback, useRef} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {ReplayFrame} from 'sentry/utils/replays/types';

function useCrumbHandlers() {
  const {
    replay,
    clearAllHighlights,
    highlight,
    removeHighlight,
    setCurrentTime,
    setCurrentHoverTime,
  } = useReplayContext();
  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() || 0;

  const mouseEnterCallback = useRef<{
    id: ReplayFrame | null;
    timeoutId: NodeJS.Timeout | null;
  }>({
    id: null,
    timeoutId: null,
  });

  const onMouseEnter = useCallback(
    (frame: ReplayFrame) => {
      // this debounces the mouseEnter callback in unison with mouseLeave
      // we ensure the pointer remains over the target element before dispatching state events in order to minimize unnecessary renders
      // this helps during scrolling or mouse move events which would otherwise fire in rapid succession slowing down our app
      mouseEnterCallback.current.id = frame;
      mouseEnterCallback.current.timeoutId = setTimeout(() => {
        if (startTimestampMs) {
          setCurrentHoverTime(frame.offsetMs);
        }

        if (frame.data && typeof frame.data === 'object' && 'nodeId' in frame.data) {
          // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
          // crumb to a tooltip
          clearAllHighlights();
          // @ts-expect-error: Property 'label' does not exist on type
          highlight({nodeId: frame.data.nodeId, annotation: frame.data.label});
        }
        mouseEnterCallback.current.id = null;
        mouseEnterCallback.current.timeoutId = null;
      }, 250);
    },
    [setCurrentHoverTime, startTimestampMs, highlight, clearAllHighlights]
  );

  const onMouseLeave = useCallback(
    (frame: ReplayFrame) => {
      // if there is a mouseEnter callback queued and we're leaving it we can just cancel the timeout
      if (mouseEnterCallback.current.id === frame) {
        if (mouseEnterCallback.current.timeoutId) {
          clearTimeout(mouseEnterCallback.current.timeoutId);
        }
        mouseEnterCallback.current.id = null;
        mouseEnterCallback.current.timeoutId = null;
        // since there is no more work to do we just return
        return;
      }

      setCurrentHoverTime(undefined);

      if (frame.data && typeof frame.data === 'object' && 'nodeId' in frame.data) {
        removeHighlight({nodeId: frame.data.nodeId});
      }
    },
    [setCurrentHoverTime, removeHighlight]
  );

  const onClickTimestamp = useCallback(
    (frame: ReplayFrame) => setCurrentTime(frame.offsetMs),
    [setCurrentTime]
  );

  return {
    onMouseEnter,
    onMouseLeave,
    onClickTimestamp,
  };
}

export default useCrumbHandlers;
