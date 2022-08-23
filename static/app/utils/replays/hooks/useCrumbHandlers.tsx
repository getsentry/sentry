import {useCallback, useMemo} from 'react';
import debounce from 'lodash/debounce';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

function useCrumbHandlers(startTimestampMs: number = 0) {
  const {
    clearAllHighlights,
    highlight,
    removeHighlight,
    setCurrentHoverTime,
    setCurrentTime,
  } = useReplayContext();

  const handleMouseEnter = useMemo(
    () =>
      debounce((item: Crumb) => {
        if (startTimestampMs) {
          setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestampMs));
        }

        if (item.data && 'nodeId' in item.data) {
          // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
          // crumb to a tooltip
          clearAllHighlights();
          highlight({nodeId: item.data.nodeId, annotation: item.data.label});
        }
      }, 200),
    [setCurrentHoverTime, startTimestampMs, highlight, clearAllHighlights]
  );

  const handleMouseLeave = useMemo(
    () =>
      debounce((item: Crumb) => {
        setCurrentHoverTime(undefined);

        if (item.data && 'nodeId' in item.data) {
          removeHighlight({nodeId: item.data.nodeId});
        }
      }, 200),
    [setCurrentHoverTime, removeHighlight]
  );

  const handleClick = useCallback(
    (crumb: Crumb) => {
      crumb.timestamp !== undefined && startTimestampMs !== undefined
        ? setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestampMs))
        : null;
    },
    [setCurrentTime, startTimestampMs]
  );

  return {
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
  };
}

export default useCrumbHandlers;
