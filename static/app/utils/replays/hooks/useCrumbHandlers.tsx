import {useCallback, useRef} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';

type RecordType = {
  offsetMs: number;
  data?:
    | Record<string, any>
    | {
        nodeId: number;
        label?: string;
      }
    | {
        element: {
          element: string;
          target: string[];
        };
        label: string;
      };
};

function getNodeIdAndLabel(record: RecordType) {
  if (!record.data || typeof record.data !== 'object') {
    return undefined;
  }
  const data = record.data;
  if (
    'element' in data &&
    'target' in data.element &&
    Array.isArray(data.element.target)
  ) {
    return {
      selector: data.element.target.join(' '),
      annotation: data.label,
    };
  }
  if ('nodeId' in data) {
    return {nodeId: data.nodeId, annotation: record.data.label};
  }
  return undefined;
}

function useCrumbHandlers() {
  const {
    replay,
    clearAllHighlights,
    addHighlight,
    removeHighlight,
    setCurrentTime,
    setCurrentHoverTime,
  } = useReplayContext();
  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() || 0;

  const mouseEnterCallback = useRef<{
    id: RecordType | null;
    timeoutId: NodeJS.Timeout | null;
  }>({
    id: null,
    timeoutId: null,
  });

  const onMouseEnter = useCallback(
    (record: RecordType) => {
      // This debounces the mouseEnter callback in unison with mouseLeave.
      // We ensure the pointer remains over the target element before dispatching
      // state events in order to minimize unnecessary renders. This helps during
      // scrolling or mouse move events which would otherwise fire in rapid
      // succession slowing down our app.
      mouseEnterCallback.current.id = record;
      mouseEnterCallback.current.timeoutId = setTimeout(() => {
        if (startTimestampMs) {
          setCurrentHoverTime(record.offsetMs);
        }

        const metadata = getNodeIdAndLabel(record);
        if (metadata) {
          // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
          // crumb to a tooltip
          clearAllHighlights();
          addHighlight(metadata);
        }
        mouseEnterCallback.current.id = null;
        mouseEnterCallback.current.timeoutId = null;
      }, 250);
    },
    [setCurrentHoverTime, startTimestampMs, addHighlight, clearAllHighlights]
  );

  const onMouseLeave = useCallback(
    (record: RecordType) => {
      if (mouseEnterCallback.current.id === record) {
        // If there is a mouseEnter callback queued and we're leaving the node
        // just cancel the timeout.
        if (mouseEnterCallback.current.timeoutId) {
          clearTimeout(mouseEnterCallback.current.timeoutId);
        }
        mouseEnterCallback.current.id = null;
        mouseEnterCallback.current.timeoutId = null;
      } else {
        setCurrentHoverTime(undefined);
        const metadata = getNodeIdAndLabel(record);
        if (metadata) {
          removeHighlight(metadata);
        }
      }
    },
    [setCurrentHoverTime, removeHighlight]
  );

  const onClickTimestamp = useCallback(
    (record: RecordType) => setCurrentTime(record.offsetMs),
    [setCurrentTime]
  );

  return {
    onMouseEnter,
    onMouseLeave,
    onClickTimestamp,
  };
}

export default useCrumbHandlers;
