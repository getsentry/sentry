import {useCallback, useRef} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {ReplayFrame} from 'sentry/utils/replays/types';

function useCrumbHandlers(startTimestampMs: number = 0) {
  const {
    clearAllHighlights,
    highlight,
    removeHighlight,
    setCurrentHoverTime,
    setCurrentTime,
  } = useReplayContext();
  const {setActiveTab} = useActiveReplayTab();

  const mouseEnterCallback = useRef<{
    id: ReplayFrame | null;
    timeoutId: NodeJS.Timeout | null;
  }>({
    id: null,
    timeoutId: null,
  });

  const handleMouseEnter = useCallback(
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

  const handleMouseLeave = useCallback(
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

  const handleClick = useCallback(
    (frame: ReplayFrame) => {
      setCurrentTime(frame.offsetMs);
      setActiveTab(getFrameDetails(frame).tabKey);
    },
    [setCurrentTime, setActiveTab]
  );

  return {
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
  };
}

export default useCrumbHandlers;
