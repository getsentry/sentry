import {useSyncExternalStore} from 'react';

import type {SectionKey} from 'sentry/views/issueDetails/context';

/**
 * How long a row stays highlighted after the timeline addresses it. Long enough to
 * find the row you were sent to, short enough that it reads as a pulse rather than a
 * selection you now have to dismiss.
 */
export const HIGHLIGHT_DURATION_MS = 2000;

interface EventContextFocus {
  ids: readonly string[];
  /**
   * Bumped on every activation, including a repeat click on the same marker. Consumers
   * use it as a React `key` so one-shot animations replay on every click.
   */
  pulse: number;
  section: SectionKey;
}

/**
 * Which rows the timeline is currently pointing at.
 *
 * This is a module store rather than a context or a query param because the rows that
 * react to it can live inside the logs/metrics drawer, and `GlobalDrawer` renders above
 * the issue page — no provider mounted here can reach it. Routing it through the URL
 * (the previous approach) did reach the drawer, but it turned a two-second highlight
 * into navigation: every click wrote and then un-wrote two query params, re-rendering
 * every `useLocation` consumer on the page twice, and it needed a nonce param, a
 * stale-location ref and a drawer-open guard on top to behave.
 */
let focus: EventContextFocus | null = null;
let pulseCounter = 0;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setFocus(next: EventContextFocus | null) {
  focus = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return focus;
}

function getServerSnapshot(): EventContextFocus | null {
  return null;
}

/**
 * Announce that the timeline addressed `section`, highlighting `ids` within it for
 * {@link HIGHLIGHT_DURATION_MS}. Sections the timeline can only scroll to (breadcrumbs,
 * trace) pass no ids, which clears any highlight left over from a previous click.
 */
export function focusEventContextRows(section: SectionKey, ids: readonly string[]) {
  clearTimeout(clearTimer);

  if (ids.length === 0) {
    setFocus(null);
    return;
  }

  setFocus({section, ids, pulse: ++pulseCounter});
  clearTimer = setTimeout(() => setFocus(null), HIGHLIGHT_DURATION_MS);
}

/** Drop the current highlight immediately. Also the reset hook for tests. */
export function clearEventContextFocus() {
  clearTimeout(clearTimer);
  setFocus(null);
}

const NO_FOCUS = {ids: [] as readonly string[], pulse: 0};

/**
 * The rows `section` should highlight right now, with the pulse token to key one-shot
 * animations on. Returns no ids when another section holds the focus.
 */
export function useEventContextFocus(section: SectionKey): {
  ids: readonly string[];
  pulse: number;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return current?.section === section ? current : NO_FOCUS;
}
