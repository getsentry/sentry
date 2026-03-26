import {useCallback, useEffect, useRef} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {
  getActionPath,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {useDsnLookupActions} from 'sentry/components/commandPalette/useDsnLookupActions';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Theme} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Stores the close method so the unmount effect can include it in analytics.
 * Set externally by toggleCommandPalette's onClose callback.
 */
export let _closeMethod = 'escape';

export default function CommandPaletteModal({Body}: ModalRenderProps) {
  const navigate = useNavigate();
  const organization = useOrganization();

  const state = useCommandPaletteState();
  const {query, session_id} = state;

  useDsnLookupActions(query);

  const openedAtRef = useRef(Date.now());
  const actionsSelectedRef = useRef(0);
  const queriesTypedRef = useRef(0);
  const completedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Reset close method on mount
  _closeMethod = 'escape';

  // Fire closed + session summary on unmount
  useEffect(() => {
    const openedAt = openedAtRef.current;
    // These refs accumulate values during the modal's lifetime and are intentionally
    // read at cleanup time to capture the final session metrics.
    const actions = actionsSelectedRef;
    const queries = queriesTypedRef;
    const done = completedRef;

    return () => {
      const s = stateRef.current;
      let depth = 0;
      let node = s.action;
      while (node !== null) {
        depth++;
        node = node.previous;
      }

      trackAnalytics('command_palette.closed', {
        organization,
        method: _closeMethod as 'escape',
        query: s.query,
        had_interaction: s.query.length > 0 || s.action !== null || actions.current > 0,
        session_id: s.session_id,
      });

      trackAnalytics('command_palette.session', {
        organization,
        session_id: s.session_id,
        duration_ms: Date.now() - openedAt,
        actions_selected: actions.current,
        queries_typed: queries.current,
        completed: done.current,
        max_drill_depth: depth,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback(
    (
      action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>,
      resultIndex: number,
      group: string
    ) => {
      const actionType = action.type;
      switch (actionType) {
        case 'navigate':
        case 'callback': {
          const path = getActionPath(state);
          const label =
            path.length > 0 ? `${path} → ${action.display.label}` : action.display.label;
          trackAnalytics('command_palette.action_selected', {
            organization,
            action: label,
            query,
            action_type: actionType,
            group,
            result_index: resultIndex,
            session_id,
          });
          _closeMethod = 'action_selected';
          actionsSelectedRef.current++;
          completedRef.current = true;
          if (actionType === 'navigate') {
            navigate(normalizeUrl(action.to));
          } else {
            action.onAction();
          }
          break;
        }
        default:
          unreachable(actionType);
          break;
      }
      closeModal();
    },
    [navigate, organization, state, query, session_id]
  );

  return (
    <Body>
      <CommandPalette
        onAction={handleSelect}
        sessionId={session_id}
        onQueryTracked={() => {
          queriesTypedRef.current++;
        }}
      />
    </Body>
  );
}

export const modalCss = (theme: Theme) => {
  return css`
    [role='document'] {
      padding: 0;

      background-color: ${theme.tokens.background.primary};
      border-top-left-radius: calc(${theme.radius.lg} + 1px);
      border-top-right-radius: calc(${theme.radius.lg} + 1px);
    }
  `;
};
