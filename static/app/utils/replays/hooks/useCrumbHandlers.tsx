import {useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';

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
    (item: Crumb) => {
      if (startTimestampMs) {
        setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestampMs));
      }

      if (item.data && 'nodeId' in item.data) {
        // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
        // crumb to a tooltip
        clearAllHighlights();
        highlight({nodeId: item.data.nodeId, annotation: item.data.label});
      }
    },
    [setCurrentHoverTime, startTimestampMs, highlight, clearAllHighlights]
  );

  const handleMouseLeave = useCallback(
    (item: Crumb) => {
      setCurrentHoverTime(undefined);

      if (item.data && 'nodeId' in item.data) {
        removeHighlight({nodeId: item.data.nodeId});
      }
    },
    [setCurrentHoverTime, removeHighlight]
  );

  const handleClick = useCallback(
    (crumb: Crumb) => {
      if (crumb.timestamp !== undefined) {
        setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestampMs));
      }

      switch (crumb.type) {
        case 'navigation':
        case 'debug':
          setActiveTab('network');
          break;
        case 'ui':
          setActiveTab('dom');
          break;
        case 'error':
        default:
          setActiveTab('console');
          break;
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
