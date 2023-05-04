import {useCallback, useRef} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {NetworkSpan} from 'sentry/views/replays/types';

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
    id: string | number | null;
    timeoutId: NodeJS.Timeout | null;
  }>({
    id: null,
    timeoutId: null,
  });

  const handleMouseEnter = useCallback(
    (item: Crumb | NetworkSpan) => {
      // this debounces the mouseEnter callback in unison with mouseLeave
      // we ensure the pointer remains over the target element before dispatching state events in order to minimize unnecessary renders
      // this helps during scrolling or mouse move events which would otherwise fire in rapid succession slowing down our app
      mouseEnterCallback.current.id = item.id;
      mouseEnterCallback.current.timeoutId = setTimeout(() => {
        if (startTimestampMs) {
          setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestampMs));
        }

        if (item.data && typeof item.data === 'object' && 'nodeId' in item.data) {
          // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
          // crumb to a tooltip
          clearAllHighlights();
          highlight({nodeId: item.data.nodeId, annotation: item.data.label});
        }
        mouseEnterCallback.current.id = null;
        mouseEnterCallback.current.timeoutId = null;
      }, 250);
    },
    [setCurrentHoverTime, startTimestampMs, highlight, clearAllHighlights]
  );

  const handleMouseLeave = useCallback(
    (item: Crumb | NetworkSpan) => {
      // if there is a mouseEnter callback queued and we're leaving it we can just cancel the timeout
      if (mouseEnterCallback.current.id === item.id) {
        if (mouseEnterCallback.current.timeoutId) {
          clearTimeout(mouseEnterCallback.current.timeoutId);
        }
        mouseEnterCallback.current.id = null;
        mouseEnterCallback.current.timeoutId = null;
        // since there is no more work to do we just return
        return;
      }

      setCurrentHoverTime(undefined);

      if (item.data && typeof item.data === 'object' && 'nodeId' in item.data) {
        removeHighlight({nodeId: item.data.nodeId});
      }
    },
    [setCurrentHoverTime, removeHighlight]
  );

  const handleClick = useCallback(
    (crumb: Crumb | NetworkSpan) => {
      if (crumb.timestamp !== undefined) {
        setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestampMs));
      }

      if (
        crumb.data &&
        typeof crumb.data === 'object' &&
        'action' in crumb.data &&
        crumb.data.action === 'largest-contentful-paint'
      ) {
        setActiveTab('dom');
        return;
      }

      if ('type' in crumb) {
        switch (crumb.type) {
          case BreadcrumbType.NAVIGATION:
            setActiveTab('network');
            break;
          case BreadcrumbType.UI:
            setActiveTab('dom');
            break;
          default:
            setActiveTab('console');
            break;
        }
      }
    },
    [setCurrentTime, startTimestampMs, setActiveTab]
  );

  return {
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
  };
}

export default useCrumbHandlers;
