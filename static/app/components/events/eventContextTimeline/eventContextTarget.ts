import {SectionKey} from 'sentry/views/issueDetails/context';

export const EVENT_CONTEXT_TARGET_QUERY_PARAM = 'eventContextTarget';

/**
 * A per-click token written alongside the target so that re-clicking the *same* marker
 * still changes the URL. Without it the router treats the repeat click as a no-op and
 * nothing re-renders, so the section scroll and the "View more" pulse never replay.
 */
export const EVENT_CONTEXT_FOCUS_NONCE_QUERY_PARAM = 'eventContextFocusNonce';

export type EventContextTarget =
  | {id: string; section: SectionKey.LOGS; type: 'log'}
  | {id: string; section: SectionKey.METRICS; type: 'metric'}
  | {section: SectionKey.BREADCRUMBS; type: 'breadcrumb'};

export function getEventContextTargetId(type: 'log' | 'metric', id: string) {
  return `event-context-${type}-${id}`;
}

/**
 * The focus query param holds one id for a single marker, or several when a cluster
 * of simultaneous items is addressed at once. Normalize either shape into a list so
 * consumers can highlight every matching row.
 */
export function getEventContextTargetIds(
  value: string | string[] | undefined | null
): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
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
