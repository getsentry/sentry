import type {Replayer} from '@sentry-internal/rrweb';

const DEFAULT_HIGHLIGHT_COLOR = 'rgba(168, 196, 236, 0.75)';

const highlightsByNodeId: Map<number, {canvas: HTMLCanvasElement}> = new Map();

interface AddHighlightParams {
  nodeId: number;
  replayer: Replayer;
  annotation?: string;
  color?: string;
  spotlight?: boolean;
}

interface RemoveHighlightParams {
  nodeId: number;
  replayer: Replayer;
}

interface ClearAllHighlightsParams {
  replayer: Replayer;
}

export function clearAllHighlights({replayer}: ClearAllHighlightsParams) {
  for (const nodeId of highlightsByNodeId.keys()) {
    removeHighlightedNode({replayer, nodeId});
  }
}

/**
 * Remove the canvas that has the highlight for a node.
 *
 * XXX: This is potentially not good if we have a lot of highlights, as we
 * are creating a new canvas PER highlight.
 */
export function removeHighlightedNode({replayer, nodeId}: RemoveHighlightParams) {
  if (!highlightsByNodeId.has(nodeId)) {
    return false;
  }

  const highlightObj = highlightsByNodeId.get(nodeId);

  if (!highlightObj || !replayer.wrapper.contains(highlightObj.canvas)) {
    return false;
  }

  replayer.wrapper.removeChild(highlightObj.canvas);
  highlightsByNodeId.delete(nodeId);

  return true;
}

/**
 * Attempt to highlight the node inside of a replay recording
 */
export function highlightNode({
  replayer,
  nodeId,
  annotation = '',
  color,
  spotlight,
}: AddHighlightParams) {
  // @ts-expect-error mouseTail is private
  const {mouseTail, wrapper} = replayer;
  const mirror = replayer.getMirror();
  const node = mirror.getNode(nodeId);

  // TODO(replays): There is some sort of race condition here when you "rewind" a replay,
  // mirror will be empty and highlight does not get added because node is null
  if (
    !node ||
    !('getBoundingClientRect' in node) ||
    !replayer.iframe.contentDocument?.body?.contains(node)
  ) {
    return null;
  }

  // @ts-ignore This builds locally, but fails in CI -- ignoring for now
  const {top, left, width, height} = node.getBoundingClientRect();
  const highlightColor = color ?? DEFAULT_HIGHLIGHT_COLOR;

  // Clone the mouseTail canvas as it has the dimensions and position that we
  // want on top of the replay. We may need to revisit this strategy as we
  // create a new canvas for every highlight. See additional notes in
  // removeHighlight() method.
  const canvas = mouseTail.cloneNode();

  const ctx = canvas.getContext('2d') as undefined | CanvasRenderingContext2D;

  if (!ctx) {
    return null;
  }

  // TODO(replays): Does not account for scrolling (should we attempt to keep highlight visible, or does it disappear)

  ctx.fillStyle = highlightColor;
  if (spotlight) {
    // Create a screen over the whole area, so only the highlighted part is normal
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(left, top, width, height);
  } else {
    // Draw a rectangle to highlight element
    ctx.fillRect(left, top, width, height);
  }
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

  const {width: textWidth} = ctx.measureText(annotation);
  const textHeight = 30;

  if (height <= textHeight + 10) {
    // Draw the text outside the box

    // Draw rect around text
    ctx.fillStyle = 'rgba(30, 30, 30, 0.75)';
    ctx.fillRect(left, top + height, textWidth, textHeight);

    // Draw text
    ctx.fillStyle = 'white';
    ctx.fillText(annotation, left + textWidth, top + height + textHeight);
  } else {
    // Draw the text inside the clicked element

    // Draw rect around text
    ctx.fillStyle = 'rgba(30, 30, 30, 0.75)';
    ctx.fillRect(left + width - textWidth, top + height - 30, textWidth, 30);

    // Draw text
    ctx.fillStyle = 'white';
    ctx.fillText(annotation, left + width, top + height);
  }

  highlightsByNodeId.set(nodeId, {
    canvas,
  });

  wrapper.insertBefore(canvas, mouseTail);

  return {
    canvas,
  };
}
