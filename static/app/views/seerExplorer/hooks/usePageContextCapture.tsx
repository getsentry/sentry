import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import type {
  LLMContextNodeSnapshot,
  LLMContextNodeType,
  LLMContextSnapshot,
} from 'sentry/views/seerExplorer/contexts/llmContextTypes';
import {useAsciiSnapshot} from 'sentry/views/seerExplorer/hooks/useAsciiSnapshot';

// Max wait for the page to finish rendering its context before capturing anyway.
const PAGE_CONTEXT_TIMEOUT_MS = 3000;

/**
 * Routes where the LLMContext tree provides structured page context, mapped to
 * the node each page registers once it has rendered.
 */
const STRUCTURED_CONTEXT_ROUTES = new Map<string, LLMContextNodeType>([
  ['/dashboard/:dashboardId/', 'dashboard'],
  ['/dashboard/:dashboardId/widget-builder/widget/new/', 'widget-builder'],
  ['/dashboard/:dashboardId/widget-builder/widget/:widgetIndex/edit/', 'widget-builder'],
  ['/explore/logs/', 'logs-explorer'],
  ['/explore/logs/trace/:traceSlug/', 'trace'],
  ['/explore/metrics/', 'metrics-explorer'],
  ['/explore/profiling/', 'profiling-explorer'],
  ['/explore/releases/', 'releases-list'],
  ['/explore/replays/', 'replays-list'],
  ['/explore/replays/:replaySlug/', 'replay-detail'],
  ['/explore/traces/', 'traces-explorer'],
  ['/explore/traces/trace/:traceSlug/', 'trace'],
  ['/issues/', 'issue-list'],
  ['/issues/views/:viewId/', 'issue-list'],
  ['/issues/errors-outages/', 'issue-list'],
  ['/issues/breached-metrics/', 'issue-list'],
  ['/issues/warnings/', 'issue-list'],
  ['/issues/:groupId/', 'issue-detail'],
  ['/issues/:groupId/events/', 'issue-detail'],
  ['/issues/:groupId/events/:eventId/', 'issue-detail'],
  ['/issues/:groupId/replays/', 'issue-detail'],
  ['/issues/:groupId/attachments/', 'issue-detail'],
  ['/issues/:groupId/distributions/', 'issue-detail'],
  ['/issues/:groupId/distributions/:tagKey/', 'issue-detail'],
  ['/monitors/', 'monitor-list'],
  ['/monitors/:detectorId/', 'monitor-detail'],
  ['/monitors/:detectorId/edit/', 'monitor-builder'],
  ['/monitors/alerts/', 'alert-list'],
  ['/monitors/alerts/:automationId/', 'alert-detail'],
  ['/monitors/alerts/:automationId/edit/', 'alert-builder'],
  ['/monitors/crons/', 'monitor-list'],
  ['/monitors/errors/', 'monitor-list'],
  ['/monitors/metrics/', 'monitor-list'],
  ['/monitors/mobile-builds/', 'monitor-list'],
  ['/monitors/my-monitors/', 'monitor-list'],
  ['/monitors/uptime/', 'monitor-list'],
]);

type CapturedPageContext = {
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
          return {snapshot, screenshot: JSON.stringify(snapshot)};
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      return {snapshot, screenshot: captureAsciiSnapshot?.(snapshot?.location)};
    },
    [captureAsciiSnapshot, getLLMContext]
  );
}

function hasNodeType(nodes: LLMContextNodeSnapshot[], nodeType: string): boolean {
  return nodes.some(
    node => node.nodeType === nodeType || hasNodeType(node.children, nodeType)
  );
}

/** Whether the route's page node has registered. Routes without one are always ready. */
function isPageContextReady(snapshot: LLMContextSnapshot, route: string): boolean {
  const expectedNodeType = STRUCTURED_CONTEXT_ROUTES.get(route);
  return expectedNodeType === undefined || hasNodeType(snapshot.nodes, expectedNodeType);
}
/** Waits until the page has finished rendering its context. Resolves false if it timed out. */
export function useWaitForPageContext() {
  const {waitForLLMContext} = useLLMContext();

  return useCallback(
    ({route, signal}: {route: string; signal?: AbortSignal}): Promise<boolean> =>
      waitForLLMContext(snapshot => isPageContextReady(snapshot, route), {
        timeoutMs: PAGE_CONTEXT_TIMEOUT_MS,
        signal,
      }),
    [waitForLLMContext]
  );
}
