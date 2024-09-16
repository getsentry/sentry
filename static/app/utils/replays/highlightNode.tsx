import type {Replayer} from '@sentry-internal/rrweb';

const DEFAULT_HIGHLIGHT_COLOR = 'rgba(168, 196, 236, 0.75)';

const highlightsByNodeIds: Map<number, {canvas: HTMLCanvasElement}> = new Map();
const highlightsBySelector: Map<string, {canvas: HTMLCanvasElement}> = new Map();

type DrawProps = {annotation: string; color: string; spotlight: boolean};

interface AddHighlightByNodeIdsParams extends Partial<DrawProps> {
  nodeIds: number[];
}
interface AddHighlightBySelectorParams extends Partial<DrawProps> {
  selector: string;
}

type AddHighlightParams = AddHighlightByNodeIdsParams | AddHighlightBySelectorParams;

type RemoveHighlightParams =
  | {
      nodeIds: number[];
    }
  | {
      selector: string;
    };

export function clearAllHighlights(replayer: Replayer) {
  for (const nodeId of highlightsByNodeIds.keys()) {
    removeHighlightedNode(replayer, {nodeIds: [nodeId]});
  }
  for (const selector of highlightsBySelector.keys()) {
    removeHighlightedNode(replayer, {selector});
  }
}

/**
 * Remove the canvas that has the highlight for a node.
 *
 * XXX: This is potentially not good if we have a lot of highlights, as we
 * are creating a new canvas PER highlight.
 */
export function removeHighlightedNode(replayer: Replayer, props: RemoveHighlightParams) {
  if ('nodeIds' in props) {
    for (const nodeId of props.nodeIds) {
      const highlightObj = highlightsByNodeIds.get(nodeId);
      if (highlightObj && replayer.wrapper.contains(highlightObj.canvas)) {
        replayer.wrapper.removeChild(highlightObj.canvas);
        highlightsByNodeIds.delete(nodeId);
      }
    }
  } else {
    const highlightObj = highlightsBySelector.get(props.selector);
    if (highlightObj && replayer.wrapper.contains(highlightObj.canvas)) {
      replayer.wrapper.removeChild(highlightObj.canvas);
      highlightsBySelector.delete(props.selector);
    }
  }
}

/**
 * Attempt to highlight the node inside of a replay recording
 */
export function highlightNode(replayer: Replayer, props: AddHighlightParams) {
  const {wrapper} = replayer;
  const mirror = replayer.getMirror();

  const nodes =
    'nodeIds' in props
      ? new Set(props.nodeIds.map(nodeId => mirror.getNode(nodeId)))
      : [replayer.iframe.contentDocument?.body.querySelector(props.selector)];

  for (const node of nodes) {
    // TODO(replays): There is some sort of race condition here when you "rewind" a replay,
    // mirror will be empty and highlight does not get added because node is null
    if (
      !node ||
      !('getBoundingClientRect' in node) ||
      !replayer.iframe.contentDocument?.body?.contains(node)
    ) {
      continue;
    }

    // Create a new canvas with the same dimensions as the iframe. We may need to
    // revisit this strategy as we create a new canvas for every highlight. See
    // additional notes in removeHighlight() method.
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;

    if (!element) {
      continue;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Number(replayer.iframe.width);
    canvas.height = Number(replayer.iframe.height);
    canvas.setAttribute('style', 'position:absolute;');

    const boundingClientRect = element.getBoundingClientRect();
    const drawProps = {
      annotation: props.annotation ?? '',
      color: props.color ?? DEFAULT_HIGHLIGHT_COLOR,
      spotlight: props.spotlight ?? false,
    };

    drawCtx(canvas, boundingClientRect, drawProps);

    if ('nodeIds' in props) {
      highlightsByNodeIds.set(mirror.getId(node), {canvas});
    } else {
      highlightsBySelector.set(props.selector, {canvas});
    }

    wrapper.insertBefore(canvas, replayer.iframe);
  }
}

function drawCtx(
  canvas: HTMLCanvasElement,
  {top, left, width, height}: DOMRect,
  {annotation, color, spotlight}: DrawProps
) {
  const ctx = canvas.getContext('2d') as undefined | CanvasRenderingContext2D;

  if (!ctx) {
    return;
  }

  // TODO(replays): Does not account for scrolling (should we attempt to keep highlight visible, or does it disappear)

  ctx.fillStyle = color;
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
}
