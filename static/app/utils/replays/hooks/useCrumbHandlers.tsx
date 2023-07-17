import {useCallback, useRef} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import {getTabKeyForFrame} from 'sentry/utils/replays/frame';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {ReplayFrame} from 'sentry/utils/replays/types';
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
    id: Crumb | NetworkSpan | ReplayFrame | null;
    timeoutId: NodeJS.Timeout | null;
  }>({
    id: null,
    timeoutId: null,
  });

  const handleMouseEnter = useCallback(
    (item: Crumb | NetworkSpan | ReplayFrame) => {
      // this debounces the mouseEnter callback in unison with mouseLeave
      // we ensure the pointer remains over the target element before dispatching state events in order to minimize unnecessary renders
      // this helps during scrolling or mouse move events which would otherwise fire in rapid succession slowing down our app
      mouseEnterCallback.current.id = item;
      mouseEnterCallback.current.timeoutId = setTimeout(() => {
        if (startTimestampMs) {
          setCurrentHoverTime(
            'offsetMs' in item
              ? item.offsetMs
              : relativeTimeInMs(item.timestamp ?? '', startTimestampMs)
          );
        }

        if (item.data && typeof item.data === 'object' && 'nodeId' in item.data) {
          // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
          // crumb to a tooltip
          clearAllHighlights();
          // @ts-expect-error: Property 'label' does not exist on type
          highlight({nodeId: item.data.nodeId, annotation: item.data.label});
        }
        mouseEnterCallback.current.id = null;
        mouseEnterCallback.current.timeoutId = null;
      }, 250);
    },
    [setCurrentHoverTime, startTimestampMs, highlight, clearAllHighlights]
  );

  const handleMouseLeave = useCallback(
    (item: Crumb | NetworkSpan | ReplayFrame) => {
      // if there is a mouseEnter callback queued and we're leaving it we can just cancel the timeout
      if (mouseEnterCallback.current.id === item) {
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
    (crumb: Crumb | NetworkSpan | ReplayFrame) => {
      if ('offsetMs' in crumb) {
        const frame = crumb; // Finding `offsetMs` means we have a frame, not a crumb or span

        setCurrentTime(frame.offsetMs);
        setActiveTab(getTabKeyForFrame(frame));
        return;
      }

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
        if (crumb.type === BreadcrumbType.ERROR) {
          setActiveTab('errors');
          return;
        }
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
