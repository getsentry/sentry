import type {Replayer} from 'rrweb';
import type {eventWithTime} from 'rrweb/typings/types';

import type {Highlight} from 'sentry/views/replays/types';

interface HighlightReplayPluginOptions {
  defaultHighlightColor?: string;
}

type HighlightPluginEvent = eventWithTime & {data: Highlight};

function isHighlightEvent(event: eventWithTime): event is HighlightPluginEvent {
  return 'nodeId' in event.data;
}

class HighlightReplayPlugin {
  defaultHighlightColor: string;

  constructor({
    defaultHighlightColor = 'rgba(168, 196, 236, 0.75)',
  }: HighlightReplayPluginOptions = {}) {
    this.defaultHighlightColor = defaultHighlightColor;
  }

  handler(event: eventWithTime, _isSync: boolean, {replayer}: {replayer: Replayer}) {
    if (!isHighlightEvent(event) || event.data.nodeId < 0) {
      return;
    }

    const highlightObj = event.data;

    // @ts-expect-error mirror, mouseTail is private
    const {mirror, mouseTail, wrapper} = replayer;
    const node = mirror.getNode(highlightObj.nodeId);

    if (replayer.iframe.contentDocument?.body.contains(node)) {
      // TODO(replays): Figure out when to change the background back

      const {top, left, width, height} = node.getBoundingClientRect();
      const highlightColor = highlightObj.color ?? this.defaultHighlightColor;

      // Clone canvas
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

      wrapper.insertBefore(canvas, mouseTail);
    }
  }
}

export default HighlightReplayPlugin;
