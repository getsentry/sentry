import type {RefObject} from 'react';
import {useCallback} from 'react';
import {Replayer} from '@sentry-internal/rrweb';

import {
  clearAllHighlights,
  highlightNode,
  removeHighlightedNode,
} from 'sentry/utils/replays/highlightNode';

interface Props {
  replayerRef: RefObject<Replayer>;
}

type HighlightParams = Parameters<typeof highlightNode>[1];
type RemoveParams = Parameters<typeof removeHighlightedNode>[1];

export default function useReplayHighlighting({replayerRef}: Props) {
  const highlightCallback = useCallback(
    (params: HighlightParams) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }

      highlightNode(replayer, params);
    },
    [replayerRef]
  );

  const clearAllHighlightsCallback = useCallback(() => {
    const replayer = replayerRef.current;
    if (!replayer) {
      return;
    }

    clearAllHighlights(replayer);
  }, [replayerRef]);

  const removeHighlightCallback = useCallback(
    (params: RemoveParams) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }

      removeHighlightedNode(replayer, params);
    },
    [replayerRef]
  );

  return {
    addHighlight: highlightCallback,
    removeHighlight: removeHighlightCallback,
    clearAllHighlights: clearAllHighlightsCallback,
  };
}
