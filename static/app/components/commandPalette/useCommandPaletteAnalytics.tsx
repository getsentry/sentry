import {useEffect, useMemo, useRef} from 'react';
import * as Sentry from '@sentry/react';
import uniqueId from 'lodash/uniqueId';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {
  getActionPath,
  type LinkedList,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

function getLinkedListDepth(node: LinkedList | null): number {
  let depth = 0;
  let current = node;
  while (current !== null) {
    depth++;
    current = current.previous;
  }
  return depth;
}

/**
 * Pure analytics observer for the command palette.
 *
 * Call once in the CommandPalette component. Reads state from context,
 * generates its own session ID, and tracks all events internally.
 *
 * Returns `recordAction` and `recordGroupAction` callbacks for action
 * selections which can't be observed from state alone.
 */
export function useCommandPaletteAnalytics(filteredActionCount: number): {
  recordAction: (
    action: CommandPaletteActionWithKey,
    resultIndex: number,
    group: string
  ) => void;
  recordGroupAction: (action: CommandPaletteActionWithKey, resultIndex: number) => void;
} {
  const organization = useOrganization();
  const state = useCommandPaletteState();

  const analyticsState = useRef({
    sessionId: uniqueId('cmd-palette-'),
    openedAt: Date.now(),
    actionsSelected: 0,
    queriesTyped: 0,
    completed: false,
    maxDrillDepth: 0,
    hadInteraction: false,
    lastTrackedQuery: '',
    prevFilteredCount: filteredActionCount,
    state,
  });

  useEffect(() => {
    if (state.query.length > 0) {
      analyticsState.current.hadInteraction = true;
    }
    analyticsState.current.state = state;
  }, [state]);

  // Debounced query tracking
  useEffect(() => {
    const s = analyticsState.current;
    if (state.query.length === 0 || state.query === s.lastTrackedQuery) {
      return undefined;
    }

    const timer = setTimeout(() => {
      s.lastTrackedQuery = state.query;
      s.queriesTyped++;
      trackAnalytics('command_palette.searched', {
        organization,
        query: state.query,
        result_count: s.prevFilteredCount,
        session_id: s.sessionId,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [state.query, organization]);

  // Track no results
  useEffect(() => {
    const s = analyticsState.current;
    const wasNonZero = s.prevFilteredCount > 0;
    s.prevFilteredCount = filteredActionCount;

    if (filteredActionCount === 0 && wasNonZero && state.query.length > 0) {
      const actionLabel =
        typeof state.action?.value.action.display.label === 'string'
          ? state.action.value.action.display.label
          : undefined;
      trackAnalytics('command_palette.no_results', {
        organization,
        query: state.query,
        action: actionLabel,
        session_id: s.sessionId,
      });
      Sentry.logger.info('Command palette returned no results', {
        query: state.query,
        action: actionLabel,
      });
    }
  }, [filteredActionCount, state.query, state.action, organization]);

  // Fire closed + session events on unmount
  useEffect(() => {
    const s = analyticsState.current;

    return () => {
      const paletteState = s.state;

      trackAnalytics('command_palette.closed', {
        organization,
        query: paletteState.query,
        had_interaction: s.hadInteraction,
        session_id: s.sessionId,
      });

      trackAnalytics('command_palette.session', {
        organization,
        session_id: s.sessionId,
        duration_ms: Date.now() - s.openedAt,
        actions_selected: s.actionsSelected,
        queries_typed: s.queriesTyped,
        completed: s.completed,
        max_drill_depth: s.maxDrillDepth,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      recordAction(
        action: CommandPaletteActionWithKey,
        resultIndex: number,
        group: string
      ) {
        const s = analyticsState.current;
        const path = getActionPath(s.state);
        const label =
          path.length > 0 ? `${path} → ${action.display.label}` : action.display.label;

        trackAnalytics('command_palette.action_selected', {
          organization,
          action: label,
          query: s.state.query,
          action_type: 'to' in action ? 'navigate' : 'callback',
          group,
          result_index: resultIndex,
          session_id: s.sessionId,
        });

        s.hadInteraction = true;
        s.actionsSelected++;
        s.completed = true;
      },
      recordGroupAction(action: CommandPaletteActionWithKey, resultIndex: number) {
        const s = analyticsState.current;

        trackAnalytics('command_palette.action_selected', {
          organization,
          action: action.display.label,
          query: s.state.query,
          action_type: 'group',
          group: '',
          result_index: resultIndex,
          session_id: s.sessionId,
        });

        s.hadInteraction = true;
        s.actionsSelected++;

        const depth = getLinkedListDepth(s.state.action) + 1;
        if (depth > s.maxDrillDepth) {
          s.maxDrillDepth = depth;
        }
      },
    }),
    [organization]
  );
}
