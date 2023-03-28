import {useCallback} from 'react';

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

  const handleMouseEnter = useCallback(
    (item: Crumb | NetworkSpan) => {
      if (startTimestampMs) {
        setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestampMs));
      }

      if (item.data && typeof item.data === 'object' && 'nodeId' in item.data) {
        // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
        // crumb to a tooltip
        clearAllHighlights();
        highlight({nodeId: item.data.nodeId, annotation: item.data.label});
      }
    },
    [setCurrentHoverTime, startTimestampMs, highlight, clearAllHighlights]
  );

  const handleMouseLeave = useCallback(
    (item: Crumb | NetworkSpan) => {
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
