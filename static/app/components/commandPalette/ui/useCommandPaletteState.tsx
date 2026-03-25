import {useMemo, useState} from 'react';

import {
  useCommandPaletteActions,
  useCommandPaletteQueryState,
} from 'sentry/components/commandPalette/context';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {fzf} from 'sentry/utils/search/fzf';

type CommandPaletteActionWithPriority = CommandPaletteActionWithKey & {
  priority: number;
};

/**
 * Brings up child actions to make them directly searchable.
 *
 * e.g. With parent "Change theme" and children "Light", "Dark", the result will be three actions:
 * - Change theme
 * - Change theme → Light
 * - Change theme → Dark
 */
function flattenActions(
  actions: CommandPaletteActionWithKey[],
  parentLabel?: string
): CommandPaletteActionWithPriority[] {
  const flattened: CommandPaletteActionWithPriority[] = [];

  for (const action of actions) {
    if (action.hidden) {
      continue;
    }

    // For child actions, prefix with parent label
    if (parentLabel) {
      flattened.push({
        ...action,
        display: {
          ...action.display,
          label: `${parentLabel} → ${action.display.label}`,
        },
        priority: 1,
      });
    } else {
      flattened.push({
        ...action,
        priority: 0,
      });
    }

    if (action.type === 'group' && action.actions.length > 0) {
      const childParentLabel = parentLabel
        ? `${parentLabel} → ${action.display.label}`
        : action.display.label;
      flattened.push(...flattenActions(action.actions, childParentLabel));
    }
  }

  return flattened;
}

export function useCommandPaletteState() {
  const {query, setQuery} = useCommandPaletteQueryState();
  const actions = useCommandPaletteActions();

  const [selectedAction, setSelectedAction] =
    useState<CommandPaletteActionWithKey | null>(null);

  const displayedActions = useMemo<CommandPaletteActionWithPriority[]>(() => {
    if (
      selectedAction &&
      selectedAction.type === 'group' &&
      selectedAction.actions.length > 0
    ) {
      return flattenActions(selectedAction.actions);
    }
    return flattenActions(actions);
  }, [actions, selectedAction]);

  const filteredActions = useMemo(() => {
    if (query.length === 0) {
      // Do not display child actions before search
      return displayedActions.filter(a => a.priority === 0);
    }

    const normalizedQuery = query.toLowerCase();

    const scored = displayedActions.map(action => {
      const label = typeof action.display.label === 'string' ? action.display.label : '';
      const details =
        typeof action.display.details === 'string' ? action.display.details : '';
      const keywords = action.keywords?.join(' ') ?? '';
      const searchText = [label, details, keywords].filter(Boolean).join(' ');
      const result = fzf(searchText, normalizedQuery, false);
      return {action, score: result.score, matched: result.end !== -1};
    });

    const matched = scored.filter(r => r.matched);
    const unmatchedSearchResults = scored.filter(
      r => !r.matched && r.action.groupingKey === 'search-result'
    );

    const sortedMatches = matched.toSorted((a, b) => {
      const priorityDiff = a.action.priority - b.action.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.score - a.score;
    });

    return [
      ...sortedMatches.map(r => r.action),
      ...unmatchedSearchResults.map(r => r.action),
    ];
  }, [query, displayedActions]);

  return {
    actions: filteredActions,
    selectedAction,
    selectAction: setSelectedAction,
    clearSelection: () => {
      setSelectedAction(null);
    },
    query,
    setQuery,
  };
}
