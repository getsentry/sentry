/**
 * Stable DOM id for a row the timeline can address, so it can be found and scrolled to
 * from outside the section that renders it.
 */
export function getEventContextTargetId(type: 'log' | 'metric', id: string) {
  return `event-context-${type}-${id}`;
}

function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const {overflowY} = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Reveal a highlighted row without ever scrolling the page. A plain `scrollIntoView`
 * bubbles up to the window, which is fine in the inline section but jarring inside a
 * drawer: the drawer's row mounts and scrolls the whole page (its effect runs before the
 * drawer's scroll-lock engages), yanking the background to the top. Scoping the scroll to
 * the nearest bounded scroll container keeps the drawer self-contained, and falls back to
 * the normal page scroll only when the row lives directly in the document flow.
 */
export function scrollEventContextRowIntoView(element: HTMLElement | null) {
  if (!element) {
    return;
  }
  const container = findScrollableAncestor(element);
  if (!container) {
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    return;
  }
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const offsetWithinContainer = elementRect.top - containerRect.top;
  const centeredOffset = (container.clientHeight - elementRect.height) / 2;
  container.scrollBy({top: offsetWithinContainer - centeredOffset, behavior: 'smooth'});
}
