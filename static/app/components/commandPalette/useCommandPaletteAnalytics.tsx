import {useEffect, useRef} from 'react';
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
 * Returns a single `recordAction` callback for final action selections
 * (navigate/callback) which can't be observed from state because the
 * `trigger action` dispatch resets it before the hook can see it.
 */
export function useCommandPaletteAnalytics(filteredActionCount: number): {
  recordAction: (
    action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>,
    resultIndex: number,
    group: string
  ) => void;
} {
  const organization = useOrganization();
  const state = useCommandPaletteState();

  const sessionIdRef = useRef(uniqueId('cmd-palette-'));

  const stateRef = useRef(state);
  stateRef.current = state;

  const openedAtRef = useRef(Date.now());
  const actionsSelectedRef = useRef(0);
  const queriesTypedRef = useRef(0);
  const completedRef = useRef(false);
  const maxDrillDepthRef = useRef(0);

  // Track group drill-downs by watching state.action changes
  const prevActionRef = useRef(state.action);
  useEffect(() => {
    const prev = prevActionRef.current;
    const curr = state.action;
    prevActionRef.current = curr;

    // Detect a push (drill-down into a group)
    if (curr !== null && curr !== prev && curr.previous === prev) {
      const groupAction = curr.value.action;
      actionsSelectedRef.current++;

      const depth = getLinkedListDepth(curr);
      if (depth > maxDrillDepthRef.current) {
        maxDrillDepthRef.current = depth;
      }

      trackAnalytics('command_palette.action_selected', {
        organization,
        action: groupAction.display.label,
        query: curr.value.query,
        action_type: 'group',
        group: groupAction.groupingKey ?? '',
        result_index: -1,
        session_id: sessionIdRef.current,
      });
    }
  }, [state.action, organization]);

  // Debounced query tracking (500ms)
  const lastTrackedQueryRef = useRef('');
  useEffect(() => {
    if (state.query.length === 0 || state.query === lastTrackedQueryRef.current) {
      return undefined;
    }

    const timer = setTimeout(() => {
      lastTrackedQueryRef.current = state.query;
      queriesTypedRef.current++;
      trackAnalytics('command_palette.searched', {
        organization,
        query: state.query,
        result_count: filteredActionCount,
        session_id: sessionIdRef.current,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [state.query, filteredActionCount, organization]);

  // Track no results
  const prevFilteredCountRef = useRef(filteredActionCount);
  useEffect(() => {
    const wasNonZero = prevFilteredCountRef.current > 0;
    prevFilteredCountRef.current = filteredActionCount;

    if (filteredActionCount === 0 && wasNonZero && state.query.length > 0) {
      const actionLabel =
        typeof state.action?.value.action.display.label === 'string'
          ? state.action.value.action.display.label
          : undefined;
      trackAnalytics('command_palette.no_results', {
        organization,
        query: state.query,
        action: actionLabel,
        session_id: sessionIdRef.current,
      });
      Sentry.logger.info('Command palette returned no results', {
        query: state.query,
        action: actionLabel,
      });
    }
  }, [filteredActionCount, state.query, state.action, organization]);

  // Fire closed + session events on unmount
  useEffect(() => {
    const openedAt = openedAtRef.current;
    const sessionId = sessionIdRef.current;
    const actions = actionsSelectedRef;
    const queries = queriesTypedRef;
    const done = completedRef;
    const depth = maxDrillDepthRef;

    return () => {
      const s = stateRef.current;

      trackAnalytics('command_palette.closed', {
        organization,
        query: s.query,
        had_interaction: s.query.length > 0 || s.action !== null || actions.current > 0,
        session_id: sessionId,
      });

      trackAnalytics('command_palette.session', {
        organization,
        session_id: sessionId,
        duration_ms: Date.now() - openedAt,
        actions_selected: actions.current,
        queries_typed: queries.current,
        completed: done.current,
        max_drill_depth: depth.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    recordAction(
      action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>,
      resultIndex: number,
      group: string
    ) {
      const path = getActionPath(stateRef.current);
      const label =
        path.length > 0 ? `${path} → ${action.display.label}` : action.display.label;

      trackAnalytics('command_palette.action_selected', {
        organization,
        action: label,
        query: stateRef.current.query,
        action_type: action.type,
        group,
        result_index: resultIndex,
        session_id: sessionIdRef.current,
      });

      actionsSelectedRef.current++;
      completedRef.current = true;
    },
  };
}
