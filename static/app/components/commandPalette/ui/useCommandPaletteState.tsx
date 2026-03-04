import {useMemo, useState} from 'react';
import type Fuse from 'fuse.js';

import {useCommandPaletteActions} from 'sentry/components/commandPalette/context';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';

type CommandPaletteActionWithPriority = CommandPaletteActionWithKey & {
  priority: number;
};

const FUZZY_SEARCH_CONFIG: Fuse.IFuseOptions<CommandPaletteActionWithPriority> = {
  keys: ['display.label', 'display.details'],
  getFn: strGetFn,
  shouldSort: true,
  minMatchCharLength: 1,
  includeScore: true,
  threshold: 0.2,
  ignoreLocation: true,
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
  const [query, setQuery] = useState('');
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

  const fuseSearch = useFuzzySearch(displayedActions, FUZZY_SEARCH_CONFIG);
  const filteredActions = useMemo(() => {
    if (!fuseSearch || query.length === 0) {
      // Do not display child actions before search
      return displayedActions.filter(a => a.priority === 0);
    }
    const fuzzyResults = fuseSearch.search(query).map(a => a.item);
    const fuzzyKeys = new Set(fuzzyResults.map(a => a.key));
    const searchResults = displayedActions.filter(
      a => a.groupingKey === 'search-result' && !fuzzyKeys.has(a.key)
    );
    return [...fuzzyResults, ...searchResults].toSorted(
      (a, b) => a.priority - b.priority
    );
  }, [fuseSearch, query, displayedActions]);

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
