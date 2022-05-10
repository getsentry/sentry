import type {Replayer} from 'rrweb';
import type {eventWithTime} from 'rrweb/typings/types';

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
  highlightsByNodeId: Map<
    number,
    {added: number; canvas: HTMLCanvasElement; expires: number}
  > = new Map();

  constructor({
    defaultHighlightColor = 'rgba(168, 196, 236, 0.75)',
  }: HighlightReplayPluginOptions = {}) {
    this.defaultHighlightColor = defaultHighlightColor;
  }

  /**
   * Remove the canvas that has the highlight for a node.
   *
   * XXX: This is potentially not good if we have a lot of highlights, as we
   * are creating a new canvas PER highlight.
   */
  removeHighlight(nodeId: number, replayer: Replayer) {
    if (!this.highlightsByNodeId.has(nodeId)) {
      return;
    }

    const highlightObj = this.highlightsByNodeId.get(nodeId);

    if (!highlightObj || !replayer.wrapper.contains(highlightObj.canvas)) {
      return;
    }

    replayer.wrapper.removeChild(highlightObj.canvas);
    this.highlightsByNodeId.delete(nodeId);
  }

  handler(event: eventWithTime, _isSync: boolean, {replayer}: {replayer: Replayer}) {
    // Check for currently hightlighted nodes that have been removed from the DOM
    if (
      this.highlightsByNodeId.size &&
      'removes' in event.data &&
      event.data.removes?.length
    ) {
      // If a highlighted node was removed from DOM we need to remove the highlight canvas
      event.data.removes.forEach(removedNode => {
        if ('id' in removedNode && this.highlightsByNodeId.has(removedNode.id)) {
          this.removeHighlight(removedNode.id, replayer);
        }
      });
    }

    // Check for expired highlights
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

    // @ts-expect-error mouseTail is private
    const {mouseTail, wrapper} = replayer;
    const mirror = replayer.getMirror();
    const node = mirror.getNode(highlightObj.nodeId);

    // TODO(replays): There is some sort of race condition here when you "rewind" a replay,
    // mirror will be empty and highlight does not get added because node is null
    if (!node || !replayer.iframe.contentDocument?.body?.contains(node)) {
      return;
    }

    // @ts-ignore This builds locally, but fails in CI -- ignoring for now
    const {top, left, width, height} = node.getBoundingClientRect();
    const highlightColor = highlightObj.color ?? this.defaultHighlightColor;

    // Clone the mouseTail canvas as it has the dimensions and position that we
    // want on top of the replay. We may need to revisit this strategy as we
    // create a new canvas for every highlight. See additional notes in
    // removeHighlight() method.
    const canvas = mouseTail.cloneNode();

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    // TODO(replays): Does not account for scrolling (should we attempt to keep highlight visible, or does it disappear)

    // Draw a rectangle to highlight element
    ctx.fillStyle = highlightColor;
    ctx.fillRect(left, top, width, height);

    // Draw a dashed border around highlight
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(left, top);
    ctx.lineTo(left + width, top);
    ctx.lineTo(left + width, top + height);
    ctx.lineTo(left, top + height);
    ctx.closePath();
    ctx.stroke();

    ctx.font = '24px Rubik';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    const textWidth = ctx.measureText(highlightObj.text).width;

    // Draw rect around text
    ctx.fillStyle = 'rgba(30, 30, 30, 0.75)';
    ctx.fillRect(left + width - textWidth, top + height - 30, textWidth, 30);

    // Draw text
    ctx.fillStyle = 'white';
    ctx.fillText(highlightObj.text, left + width, top + height);

    this.highlightsByNodeId.set(highlightObj.nodeId, {
      canvas,
      added: event.timestamp,
      expires: event.timestamp + DEFAULT_HIDE_HIGHLIGHT_TIMEOUT,
    });
    wrapper.insertBefore(canvas, mouseTail);
  }
}

export default HighlightReplayPlugin;
