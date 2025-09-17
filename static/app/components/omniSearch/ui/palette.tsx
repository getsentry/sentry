import {Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';
import type Fuse from 'fuse.js';

import {closeModal} from 'sentry/actionCreators/modal';
import type {MenuListItemProps} from 'sentry/components/core/menuListItem';
import type {OmniAction} from 'sentry/components/omniSearch/types';
import {OmniResultsList} from 'sentry/components/omniSearch/ui/results';
import {useApiDynamicActions} from 'sentry/components/omniSearch/useApiDynamicActions';
import {useCommandDynamicActions} from 'sentry/components/omniSearch/useCommandDynamicActions';
import {useFormDynamicActions} from 'sentry/components/omniSearch/useFormDynamicActions';
import {useOmniSearchState} from 'sentry/components/omniSearch/useOmniSearchState';
import {useOrganizationsDynamicActions} from 'sentry/components/omniSearch/useOrganizationsDynamicActions';
import {useRouteDynamicActions} from 'sentry/components/omniSearch/useRouteDynamicActions';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';

interface OmniActionWithPriority extends OmniAction {
  priority: number;
}

type OmniActionMenuItem = MenuListItemProps & {
  children: OmniActionMenuItem[];
  key: string;
  hideCheck?: boolean;
};

// We need to limit the number of displayed actions for performance reasons
// TODO: Consider other options, like limiting large sections directly or virtualizing the list
const MAX_ACTIONS_PER_SECTION = 10;

const FUZZY_SEARCH_CONFIG: Fuse.IFuseOptions<OmniActionWithPriority> = {
  keys: ['label', 'fullLabel', 'details'],
  getFn: strGetFn,
  shouldSort: true,
  minMatchCharLength: 1,
  includeScore: true,
  threshold: 0.2,
  ignoreLocation: true,
};

/**
 * Recursively flattens an array of actions, including all their children
 * Child actions will have their labels prefixed with parent title and arrow
 */
function flattenActions(actions: OmniAction[], parentLabel?: string): OmniAction[] {
  const flattened: OmniAction[] = [];

  for (const action of actions) {
    // For child actions, prefix with parent label
    if (parentLabel) {
      flattened.push({
        ...action,
        label: `${parentLabel} → ${action.label}`,
      });
    } else {
      // For top-level actions, add them as-is
      flattened.push(action);
    }

    if (action.children && action.children.length > 0) {
      // Use the original action label (not the prefixed one) as parent context
      const childParentLabel = parentLabel
        ? `${parentLabel} → ${action.label}`
        : action.label;
      flattened.push(...flattenActions(action.children, childParentLabel));
    }
  }

  return flattened;
}

function actionToMenuItem(action: OmniAction): OmniActionMenuItem {
  return {
    key: action.key,
    label: action.label,
    details: action.details,
    leadingItems: action.actionIcon ? (
      <IconWrap>{action.actionIcon}</IconWrap>
    ) : undefined,
    children:
      action.children?.slice(0, MAX_ACTIONS_PER_SECTION).map(actionToMenuItem) ?? [],
    hideCheck: true,
  };
}

export function OmniSearchPalette() {
  const {
    focusedArea,
    actions: availableActions,
    selectedAction,
    selectAction,
    clearSelection,
  } = useOmniSearchState();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);
  useTraceExploreAiQuerySetup({enableAISearch: true});

  // Get dynamic actions from all sources (no filtering - palette handles the search)
  const apiActions = useApiDynamicActions(debouncedQuery);
  const formActions = useFormDynamicActions();
  const routeActions = useRouteDynamicActions();
  const orgActions = useOrganizationsDynamicActions();
  const commandActions = useCommandDynamicActions();

  // Combine all dynamic actions (excluding recent issues for now)
  const dynamicActions = useMemo(() => {
    return [...routeActions, ...orgActions, ...commandActions, ...formActions];
  }, [formActions, routeActions, orgActions, commandActions]);

  const searchableActions = useMemo<OmniActionWithPriority[]>(() => {
    if (selectedAction?.children?.length) {
      return [...selectedAction.children.map(a => ({...a, priority: 0}))];
    }

    return [
      ...flattenActions(availableActions).map(a => ({...a, priority: 1})),
      ...flattenActions(dynamicActions).map(a => ({...a, priority: 2})),
      ...flattenActions(apiActions).map(a => ({...a, priority: 3})),
    ];
  }, [selectedAction?.children, availableActions, dynamicActions, apiActions]);

  const fuseSearch = useFuzzySearch(searchableActions, FUZZY_SEARCH_CONFIG);
  const filteredAvailableActions = useMemo(() => {
    if (!fuseSearch) {
      return [];
    }
    if (query.length === 0) {
      return availableActions;
    }
    return fuseSearch
      .search(query)
      .map(a => a.item)
      .sort((a, b) => a.priority - b.priority);
  }, [fuseSearch, query, availableActions]);

  const groupedMenuItems = useMemo<OmniActionMenuItem[]>(() => {
    // Group by section label
    const itemsBySection = new Map<string, OmniActionMenuItem[]>();
    for (const action of filteredAvailableActions) {
      const sectionLabel = action.section ?? '';
      const list = itemsBySection.get(sectionLabel) ?? [];
      list.push(actionToMenuItem(action));
      itemsBySection.set(sectionLabel, list);
    }

    return Array.from(itemsBySection.keys())
      .map((sectionKey): OmniActionMenuItem => {
        const children = itemsBySection.get(sectionKey) ?? [];
        return {
          key: sectionKey,
          label: sectionKey,
          children: children.slice(0, MAX_ACTIONS_PER_SECTION),
        };
      })
      .filter(section => section.children.length > 0);
  }, [filteredAvailableActions]);

  const handleSelect = useCallback(
    (action: OmniAction) => {
      if (action.disabled) {
        return;
      }
      if (action.children && action.children.length > 0) {
        selectAction(action);
        return;
      }
      if (action.onAction) {
        action.onAction();
      }
      if (action.to) {
        navigate(normalizeUrl(action.to));
      }

      if (!action.keepOpen) {
        closeModal();
      }
    },
    [navigate, selectAction]
  );

  // When an action has been selected, clear the query and focus the input
  useLayoutEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [selectedAction]);

  const handleActionByKey = useCallback(
    (selectionKey: React.Key | null | undefined) => {
      if (selectionKey === null || selectionKey === undefined) {
        return;
      }
      const action = searchableActions.find(a => a.key === selectionKey);
      if (action) {
        handleSelect(action);
      }
    },
    [searchableActions, handleSelect]
  );

  return (
    <Fragment>
      <OmniResultsList
        onActionKey={handleActionByKey}
        inputRef={inputRef}
        query={query}
        setQuery={setQuery}
        focusedArea={focusedArea}
        clearSelection={clearSelection}
        selectedAction={selectedAction}
      >
        {groupedMenuItems.map(({key: sectionKey, label, children}) => (
          <Section key={sectionKey} title={label}>
            {children.map(({key: actionKey, ...action}) => (
              <Item<OmniActionMenuItem> key={actionKey} {...action}>
                {action.label}
              </Item>
            ))}
          </Section>
        ))}
      </OmniResultsList>
    </Fragment>
  );
}

const IconWrap = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${p => p.theme.iconSizes.md};
  height: ${p => p.theme.iconSizes.md};
`;
