import {useCallback, useDeferredValue, useSyncExternalStore} from 'react';
import * as Sentry from '@sentry/react';

import {
  useLLMContext,
  useLLMContextRegistry,
} from 'sentry/views/seerExplorer/contexts/llmContext';
import type {
  LLMContextNodeType,
  LLMContextSnapshot,
} from 'sentry/views/seerExplorer/contexts/llmContextTypes';
import {useAsciiSnapshot} from 'sentry/views/seerExplorer/hooks/useAsciiSnapshot';

/** Routes where the LLMContext tree provides structured page context. */
const STRUCTURED_CONTEXT_ROUTES = new Set([
  '/dashboard/:dashboardId/',
  '/dashboard/:dashboardId/widget-builder/widget/new/',
  '/dashboard/:dashboardId/widget-builder/widget/:widgetIndex/edit/',
  '/explore/logs/',
  '/explore/logs/trace/:traceSlug/',
  '/explore/metrics/',
  '/explore/profiling/',
  '/explore/releases/',
  '/explore/replays/',
  '/explore/replays/:replaySlug/',
  '/explore/traces/',
  '/explore/traces/trace/:traceSlug/',
  '/issues/',
  '/issues/views/:viewId/',
  '/issues/errors-outages/',
  '/issues/breached-metrics/',
  '/issues/warnings/',
  '/issues/:groupId/',
  '/issues/:groupId/events/',
  '/issues/:groupId/events/:eventId/',
  '/issues/:groupId/replays/',
  '/issues/:groupId/attachments/',
  '/issues/:groupId/distributions/',
  '/issues/:groupId/distributions/:tagKey/',
  '/monitors/',
  '/monitors/:detectorId/',
  '/monitors/:detectorId/edit/',
  '/monitors/alerts/',
  '/monitors/alerts/:automationId/',
  '/monitors/alerts/:automationId/edit/',
  '/monitors/crons/',
  '/monitors/errors/',
  '/monitors/metrics/',
  '/monitors/mobile-builds/',
  '/monitors/my-monitors/',
  '/monitors/uptime/',
]);

/**
 * Routes whose page context is only complete once the page node(s) has loaded,
 * mapped to that node(s). If the node(s) registers before its data loads,
 * also pass `isLoading` to useLLMContext.
 */
const PAGE_CONTEXT_READY_NODES = new Map<string, LLMContextNodeType[]>([
  // The "dashboard" node registers before its widgets, which mount lazily,
  // so at least one "widget" node must be ready. Prebuilt dashboards showing
  // onboarding have no widgets, so "dashboard" node being ready is enough.
  ['/dashboard/:dashboardId/', ['dashboard', 'widget']],
  ['/explore/replays/:replaySlug/', ['replay-detail']],
  ['/issues/:groupId/', ['issue-detail']],
  ['/issues/:groupId/events/', ['issue-detail']],
  ['/issues/:groupId/events/:eventId/', ['issue-detail']],
  ['/issues/:groupId/replays/', ['issue-detail']],
  ['/issues/:groupId/attachments/', ['issue-detail']],
  ['/issues/:groupId/distributions/', ['issue-detail']],
  ['/issues/:groupId/distributions/:tagKey/', ['issue-detail']],
]);

type CapturedPageContext = {
  /** Whether `screenshot` is the structured snapshot rather than an ASCII rendering. */
  isStructured: boolean;
  screenshot: string | undefined;
  snapshot: LLMContextSnapshot | undefined;
};

/**
 * Captures what the user is looking at, as sent to Seer with chat messages and
 * suggestion requests. Call from effects or event handlers, not during render.
 */
export function usePageContextCapture() {
  const captureAsciiSnapshot = useAsciiSnapshot();
  const {getLLMContext} = useLLMContext();

  return useCallback(
    ({
      route,
      allowStructured,
    }: {
      allowStructured: boolean;
      route: string;
    }): CapturedPageContext => {
      // The snapshot is the source of location for both branches below, so take it
      // once here rather than only on the structured path.
      let snapshot: LLMContextSnapshot | undefined;
      try {
        snapshot = getLLMContext();
      } catch (e) {
        Sentry.captureException(e);
      }

      // Send structured LLMContext JSON on allowlisted pages; fall back to a
      // coarse ASCII screenshot everywhere else.
      if (snapshot && allowStructured && STRUCTURED_CONTEXT_ROUTES.has(route)) {
        try {
          return {snapshot, screenshot: JSON.stringify(snapshot), isStructured: true};
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      return {
        snapshot,
        screenshot: captureAsciiSnapshot?.(snapshot?.location),
        isStructured: false,
      };
    },
    [captureAsciiSnapshot, getLLMContext]
  );
}

/**
 * Whether the route's page context is registered and not loading anymore.
 * Routes not in PAGE_CONTEXT_READY_NODES only wait for the guard below.
 */
export function usePageContextReady(route: string, contextKey: string): boolean {
  const {subscribe, isNodeReady} = useLLMContextRegistry();
  const expectedNodeTypes = PAGE_CONTEXT_READY_NODES.get(route);
  const isReady = useSyncExternalStore(
    subscribe,
    () => expectedNodeTypes === undefined || expectedNodeTypes.some(isNodeReady)
  );

  // After contextKey changes, this render still sees the previous page context, which
  // updates when it commits. The deferred key catches up in a later render, after that.
  const settledContextKey = useDeferredValue(contextKey, null);

  return isReady && settledContextKey === contextKey;
}
