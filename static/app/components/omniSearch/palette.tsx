import {Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';
import serryLottieAnimation from 'getsentry-images/omni/mshk-image-to-lottie.json';

import {closeModal} from 'sentry/actionCreators/modal';
import {Tag} from 'sentry/components/core/badge/tag';
import SeeryCharacter from 'sentry/components/omniSearch/animation/seeryCharacter';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {IconClock} from 'sentry/icons/iconClock';
import {IconDocs} from 'sentry/icons/iconDocs';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {useNavigationHistory} from 'sentry/utils/navigationStorage';
import {useSeenIssues} from 'sentry/utils/seenIssuesStorage';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import type {OmniAction} from './types';
import {useApiDynamicActions} from './useApiDynamicActions';
import {useCommandDynamicActions} from './useCommandDynamicActions';
import {useFormDynamicActions} from './useFormDynamicActions';
import {useLLMRoutingDynamicActions} from './useLLMRoutingDynamicActions';
import {useOmniSearchState} from './useOmniSearchState';
import {useOrganizationsDynamicActions} from './useOrganizationsDynamicActions';
import {useRouteDynamicActions} from './useRouteDynamicActions';

/**
 * Very basic palette UI using cmdk that lists all registered actions.
 *
 * NOTE: This is intentionally minimal and will be iterated on.
 */
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

  const {getSeenIssues} = useSeenIssues();
  const {getRecentNavigationHistory} = useNavigationHistory();

  // Get ALL seen issues (no limit here)
  const allRecentIssueActions: OmniAction[] = useMemo(() => {
    return getSeenIssues().map(issue => ({
      key: `recent-issue-${issue.id}`,
      areaKey: 'recent',
      section: 'Recently Viewed Issues',
      label: issue.issue.title || issue.issue.id,
      actionIcon: <IconDocs />,
      onAction: () => {
        navigate(normalizeUrl(`/issues/${issue.id}`));
      },
    }));
  }, [navigate, getSeenIssues]);

  // Get recent navigation history (excluding current path to avoid self-navigation)
  const allNavigationHistoryActions: OmniAction[] = useMemo(() => {
    return getRecentNavigationHistory(20)
      .filter(entry => entry.path !== window.location.pathname + window.location.search)
      .map(entry => ({
        key: `nav-history-${entry.id}`,
        areaKey: 'navigation',
        section: 'Navigation History',
        label: entry.title,
        details: entry.path,
        actionIcon: <IconClock />,
        onAction: () => {
          navigate(normalizeUrl(entry.path));
        },
      }));
  }, [navigate, getRecentNavigationHistory]);

  // Get dynamic actions from all sources (no filtering - palette handles the search)
  const apiActions = useApiDynamicActions(debouncedQuery);
  const formActions = useFormDynamicActions();
  const routeActions = useRouteDynamicActions();
  const orgActions = useOrganizationsDynamicActions();
  const commandActions = useCommandDynamicActions();

  const llmRoutingActions = useLLMRoutingDynamicActions(debouncedQuery);

  // Combine all dynamic actions (excluding recent issues for now)
  const dynamicActions = useMemo(
    () => [
      ...routeActions,
      ...orgActions,
      ...commandActions,
      ...formActions,
      ...apiActions,
    ],
    [apiActions, formActions, routeActions, orgActions, commandActions]
  );

  const [filteredAvailableActions, setFilteredAvailableActions] = useState<OmniAction[]>(
    []
  );
  const [filteredRecentIssues, setFilteredRecentIssues] = useState<OmniAction[]>([]);
  const [filteredNavigationHistory, setFilteredNavigationHistory] = useState<
    OmniAction[]
  >([]);

  // Fuzzy search for general actions
  useEffect(() => {
    createFuzzySearch([...availableActions, ...dynamicActions], {
      keys: ['label', 'fullLabel', 'details'],
      getFn: strGetFn,
      shouldSort: false,
      minMatchCharLength: 1,
    }).then(f => {
      setFilteredAvailableActions(f.search(debouncedQuery).map(r => r.item));
    });
  }, [availableActions, debouncedQuery, dynamicActions]);

  // Fuzzy search for recent issues separately to control the limit
  useEffect(() => {
    if (debouncedQuery) {
      createFuzzySearch(allRecentIssueActions, {
        keys: ['label'],
        getFn: strGetFn,
        shouldSort: false,
      }).then(f => {
        // Fuzzy search ALL recent issues, then limit to max 5
        const searchResults = f.search(debouncedQuery).map(r => r.item);
        setFilteredRecentIssues(searchResults.slice(0, 5));
      });
    } else {
      // When no query, show first 5 recent issues
      setFilteredRecentIssues(allRecentIssueActions.slice(0, 5));
    }
  }, [allRecentIssueActions, debouncedQuery]);

  // Fuzzy search for navigation history separately to control the limit
  useEffect(() => {
    if (debouncedQuery) {
      createFuzzySearch(allNavigationHistoryActions, {
        keys: ['label', 'details'],
        getFn: strGetFn,
        shouldSort: false,
      }).then(f => {
        // Fuzzy search ALL navigation history, then limit to max 8
        const searchResults = f.search(debouncedQuery).map(r => r.item);
        setFilteredNavigationHistory(searchResults.slice(0, 8));
      });
    } else {
      // When no query, show first 8 navigation history entries
      setFilteredNavigationHistory(allNavigationHistoryActions.slice(0, 8));
    }
  }, [allNavigationHistoryActions, debouncedQuery]);

  const grouped = useMemo(() => {
    // Filter actions based on query
    const actions = debouncedQuery
      ? [
          ...filteredAvailableActions,
          ...filteredRecentIssues,
          ...filteredNavigationHistory,
        ]
      : [...filteredRecentIssues, ...filteredNavigationHistory, ...availableActions];

    // always include the llm routing actions if possible
    actions.push(...llmRoutingActions);

    // Group by section label
    const bySection = new Map<string, OmniAction[]>();
    for (const action of actions) {
      const sectionLabel = action.section ?? '';
      const list = bySection.get(sectionLabel) ?? [];
      list.push(action);
      bySection.set(sectionLabel, list);
    }

    const sectionKeys = Array.from(bySection.keys());

    return sectionKeys.map(sectionKey => {
      const label = sectionKey;
      const items = bySection.get(sectionKey) ?? [];
      return {sectionKey, label, items};
    });
  }, [
    availableActions,
    debouncedQuery,
    filteredAvailableActions,
    filteredRecentIssues,
    filteredNavigationHistory,
    llmRoutingActions,
  ]);

  // Get the first item's key to set as the default selected value
  const firstItemKey = useMemo(() => {
    const firstItem = grouped.find(group => group.items.length > 0)?.items[0];
    return firstItem?.key || '';
  }, [grouped]);

  const handleSelect = (action: OmniAction) => {
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

    // TODO: Any other action handlers?

    if (!action.keepOpen) {
      closeModal();
    }
  };

  // When an action has been selected, clear the query and focus the input
  useLayoutEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
      setFilteredAvailableActions([]);
      setFilteredNavigationHistory([]);
    }
  }, [selectedAction]);

  const placeholder = useMemo(() => {
    if (selectedAction) {
      return selectedAction.label;
    }
    return 'Type for actions…';
  }, [selectedAction]);

  return (
    <Fragment>
      <SeeryCharacter animationData={serryLottieAnimation} size={200} />
      <StyledCommand label="OmniSearch" shouldFilter={false} value={firstItemKey}>
        <Header>
          {focusedArea && (
            <FocusedAreaContainer>
              <FocusedArea>{focusedArea.label}</FocusedArea>
            </FocusedAreaContainer>
          )}
          <SearchInputContainer>
            <SearchInput
              autoFocus
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              onKeyDown={e => {
                if (e.key === 'Backspace' && query === '') {
                  clearSelection();
                  e.preventDefault();
                }
              }}
              placeholder={placeholder}
            />
          </SearchInputContainer>
        </Header>
        <CommandPrimitive.Command.List>
          {grouped.every(g => g.items.length === 0) ? (
            <CommandPrimitive.Command.Empty>No results</CommandPrimitive.Command.Empty>
          ) : (
            grouped.map(group => (
              <Fragment key={group.sectionKey}>
                {group.items.length > 0 && (
                  <CommandPrimitive.Command.Group heading={group.label}>
                    {group.items.map(item => (
                      <CommandPrimitive.Command.Item
                        key={item.key}
                        value={item.key}
                        onSelect={() => handleSelect(item)}
                        disabled={item.disabled}
                      >
                        <ItemRow>
                          {item.actionIcon && (
                            <IconDefaultsProvider size="sm">
                              <IconWrapper>{item.actionIcon}</IconWrapper>
                            </IconDefaultsProvider>
                          )}
                          <OverflowHidden>
                            <div>{item.label}</div>
                            {item.details && <ItemDetails>{item.details}</ItemDetails>}
                          </OverflowHidden>
                        </ItemRow>
                      </CommandPrimitive.Command.Item>
                    ))}
                  </CommandPrimitive.Command.Group>
                )}
              </Fragment>
            ))
          )}
        </CommandPrimitive.Command.List>
      </StyledCommand>
    </Fragment>
  );
}

const Header = styled('div')`
  position: relative;
`;

const SearchInputContainer = styled('div')`
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 16px;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SearchInput = styled(CommandPrimitive.Command.Input)`
  position: relative;
  background-color: ${p => p.theme.background};
  width: 100%;
  outline: none;
  border: none;
  font-size: ${p => p.theme.fontSize.lg};
  line-height: 1;
  height: 40px;
`;

const FocusedAreaContainer = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  padding-bottom: 0;
`;

const FocusedArea = styled(Tag)`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeight.bold};
  border: 1px solid ${p => p.theme.border};
  width: fit-content;
  border-radius: ${p => p.theme.borderRadius};
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  width: 18px;

  opacity: 0.75;
  transition: all 0.1s ease-out;
`;

const StyledCommand = styled(CommandPrimitive.Command)`
  &[cmdk-root] {
    width: 100%;
    background: ${p => p.theme.background};
    border-radius: 6px;
    overflow: hidden;
    height: 520px;
  }

  [cmdk-list] {
    padding: 6px;
    min-height: 150px;
    max-height: 500px;
    overflow-y: auto;

    &:focus {
      outline: none;
    }
  }

  [cmdk-group] {
    margin-top: 8px;

    + * {
      [cmdk-group-heading] {
        padding-top: 12px;
        border-top: 1px solid ${p => p.theme.border};
      }
    }
  }

  [cmdk-group-heading] {
    text-transform: uppercase;
    font-size: ${p => p.theme.fontSize.xs};
    letter-spacing: 0.02em;
    font-weight: 600;
    color: ${p => p.theme.subText};
    padding-bottom: 4px;
    margin: 0 12px;
  }

  [cmdk-item] {
    text-transform: none;
    padding: 12px;
    font-size: ${p => p.theme.fontSize.md};
    color: ${p => p.theme.textColor};
    cursor: pointer;
    border-radius: 4px;
    position: relative;

    &[data-selected='true'] {
      background-color: ${p => p.theme.backgroundSecondary};
      color: ${p => p.theme.purple400};

      ${IconWrapper} {
        opacity: 1;
        transform: scale(1.1);
      }
    }
  }
`;

const ItemRow = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: start;
  justify-content: start;
  overflow: hidden;
`;

const ItemDetails = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis}
`;

const OverflowHidden = styled('div')`
  overflow: hidden;
`;
