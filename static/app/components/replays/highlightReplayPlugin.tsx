import type {Replayer} from 'rrweb';
import type {eventWithTime} from 'rrweb/typings/types';

import {highlightNode, removeHighlightedNode} from 'sentry/utils/replays/highlightNode';
import type {Highlight} from 'sentry/views/replays/types';

interface HighlightReplayPluginOptions {
  defaultHighlightColor?: string;
}

type HighlightPluginEvent = eventWithTime & {data: Highlight};

const DEFAULT_HIDE_HIGHLIGHT_TIMEOUT = 5000;

function isHighlightEvent(event: eventWithTime): event is HighlightPluginEvent {
  return 'nodeId' in event.data;
}

class HighlightReplayPlugin {
  defaultHighlightColor: string;
  highlightsByNodeId: Map<number, {added: number; expires: number}> = new Map();

  constructor({
    defaultHighlightColor = 'rgba(168, 196, 236, 0.75)',
  }: HighlightReplayPluginOptions = {}) {
    this.defaultHighlightColor = defaultHighlightColor;
  }

  /**
   * Remove the highlighted node
   */
  removeHighlight(nodeId: number, replayer: Replayer) {
    if (removeHighlightedNode({nodeId, replayer})) {
      this.highlightsByNodeId.delete(nodeId);
    }
  }

  handler(event: eventWithTime, _isSync: boolean, {replayer}: {replayer: Replayer}) {
    // Check for currently highlighted nodes that have been removed from the DOM in the replay
    if (
      this.highlightsByNodeId.size &&
      'removes' in event.data &&
      event.data.removes?.length
    ) {
      // If a highlighted node was removed from DOM we need to remove the highlight canvas
      event.data.removes.forEach(removedNode => {
        if ('id' in removedNode) {
          this.removeHighlight(removedNode.id, replayer);
        }
      });
    }

    // Check and remove expired highlights
    if (this.highlightsByNodeId.size) {
      Array.from(this.highlightsByNodeId.entries())
        .filter(
          ([, {added, expires}]) => event.timestamp < added || event.timestamp >= expires
        )
        .forEach(([nodeId]) => {
          this.removeHighlight(nodeId, replayer);
        });
    }

    // If we have highlights and the replay event is a scroll event, update the highlight
    // `event.type` == EventType.IncrementalSnapshot (https://github.com/rrweb-io/rrweb/blob/master/packages/rrweb/src/types.ts#L20)
    // `event.data.source` == IncrementalSource.Scroll (https://github.com/rrweb-io/rrweb/blob/master/packages/rrweb/src/types.ts#L83)
    if (this.highlightsByNodeId.size && event.type === 3 && event.data.source === 3) {
      // TODO(replays): Re-draw rect instead of removing it (:
      Array.from(this.highlightsByNodeId.entries()).forEach(([nodeId]) => {
        this.removeHighlight(nodeId, replayer);
      });
    }

    if (!isHighlightEvent(event) || event.data.nodeId < 0) {
      return;
    }

    const highlightObj = event.data;

    const {canvas} = highlightNode({
      replayer,
      nodeId: highlightObj.nodeId,
      annotation: highlightObj.text,
    });

    if (!canvas) {
      return;
    }

    this.highlightsByNodeId.set(highlightObj.nodeId, {
      added: event.timestamp,
      expires: event.timestamp + DEFAULT_HIDE_HIGHLIGHT_TIMEOUT,
    });
  }
}

export default HighlightReplayPlugin;
