import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import type {LLMContextSnapshot} from 'sentry/views/seerExplorer/contexts/llmContextTypes';
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
