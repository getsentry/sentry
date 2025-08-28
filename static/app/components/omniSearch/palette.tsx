import {Fragment, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';
import type Fuse from 'fuse.js';

import error from 'sentry-images/spot/cmd-k-error.svg';

import {closeModal} from 'sentry/actionCreators/modal';
import {Tag} from 'sentry/components/core/badge/tag';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';

import type {OmniAction} from './types';
import {useApiDynamicActions} from './useApiDynamicActions';
import {useCommandDynamicActions} from './useCommandDynamicActions';
import {useFormDynamicActions} from './useFormDynamicActions';
import {useOmniSearchState} from './useOmniSearchState';
import {useOrganizationsDynamicActions} from './useOrganizationsDynamicActions';
import {useRouteDynamicActions} from './useRouteDynamicActions';

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

interface OmniActionWithPriority extends OmniAction {
  priority: number;
}

const FUZZY_SEARCH_CONFIG: Fuse.IFuseOptions<OmniActionWithPriority> = {
  keys: ['label', 'fullLabel', 'details'],
  getFn: strGetFn,
  shouldSort: true,
  minMatchCharLength: 1,
  includeScore: true,
  threshold: 0.2,
  ignoreLocation: true,
};

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

  const grouped = useMemo(() => {
    // Group by section label
    const bySection = new Map<string, OmniAction[]>();
    for (const action of filteredAvailableActions) {
      const sectionLabel = action.section ?? '';
      const list = bySection.get(sectionLabel) ?? [];
      if (sectionLabel !== 'Recently Viewed' || list.length < 5) {
        list.push(action);
      }
      bySection.set(sectionLabel, list);
    }

    const sectionKeys = Array.from(bySection.keys());

    return sectionKeys.map(sectionKey => {
      const label = sectionKey;
      const items = bySection.get(sectionKey) ?? [];
      return {sectionKey, label, items};
    });
  }, [filteredAvailableActions]);

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
      <StyledCommand label="OmniSearch" shouldFilter={false} loop>
        <Header>
          {focusedArea && (
            <FocusedAreaContainer>
              <FocusedArea>{focusedArea.label}</FocusedArea>
            </FocusedAreaContainer>
          )}
          <SearchInputContainer>
            {selectedAction && (
              <BackButton
                onClick={() => {
                  clearSelection();
                }}
              >
                <IconArrow direction="left" size="sm" />
              </BackButton>
            )}
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
            <CommandPrimitive.Command.Empty>
              <img src={error} alt="No results" />
              <p>Whoops… we couldn't find any results matching your search.</p>
              <p>Try rephrasing your query maybe?</p>
            </CommandPrimitive.Command.Empty>
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
                        hidden={item.hidden}
                      >
                        <ItemRow>
                          {item.actionIcon && (
                            <IconDefaultsProvider size="sm">
                              <IconWrapper>{item.actionIcon}</IconWrapper>
                            </IconDefaultsProvider>
                          )}
                          <OverflowHidden>
                            <div>
                              {item.label}
                              {item.children && item.children.length > 0 && '…'}
                            </div>
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

  [data-matrix-mode='true'] & {
    background-color: #101e13;
    color: #00ff00;
  }
`;

const SearchInputContainer = styled('div')`
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 16px;
  border-bottom: 1px solid ${p => p.theme.border};

  [data-matrix-mode='true'] & {
    padding: 2px 10px;
    gap: 4px;
    border: 2px solid #1a5200;
  }
`;

const BackButton = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  color: ${p => p.theme.subText};
  transition: all 0.1s ease-out;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
    color: ${p => p.theme.textColor};
  }

  [data-matrix-mode='true'] & {
    color: #00ff00;
    transition: all 0.2s ease;
    padding: 4px;
    border-radius: 0;

    &:hover {
      background-color: rgba(0, 255, 0, 0.1);
      color: #00ff00;
    }
  }
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

  &:disabled {
    opacity: 0.5;
  }

  [data-matrix-mode='true'] & {
    background-color: #101e13;
    color: #00ff00;
    font-family: 'Departure Mono', monospace;
    text-transform: uppercase;
    height: 40px;
    font-size: 14px;

    &::placeholder {
      color: rgba(0, 255, 0, 0.6);
    }

    &:focus {
      border-color: #00ff00;
    }
  }
`;

const FocusedAreaContainer = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  padding-bottom: 0;

  [data-matrix-mode='true'] & {
    padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  }
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

  [data-matrix-mode='true'] & {
    background-color: #101e13;
    color: #00ff00;
    border-color: #00ff00;
    font-family: 'Departure Mono', monospace;
    text-transform: uppercase;

    font-size: 10px;
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  }
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  width: 18px;

  opacity: 0.75;
  transition: all 0.1s ease-out;

  [data-matrix-mode='true'] & {
    opacity: 0.5;
  }
`;

const StyledCommand = styled(CommandPrimitive.Command)`
  &[cmdk-root] {
    width: 100%;
    background: ${p => p.theme.background};
    border-radius: 6px;
    overflow: hidden;

    [data-matrix-mode='true'] & {
      background: #101e13;
      border-radius: 0;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;

      &:before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: calc(100% + 12px);
        height: calc(100% + 12px);
        background: #101e13;
      }
    }
  }

  [cmdk-list] {
    position: relative;
    padding: 6px;
    height: 500px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-padding-block-start: 64px;
    scroll-padding-block-end: 64px;

    &:focus {
      outline: none;
    }

    background:
      /* Shadow covers */
      linear-gradient(${p => p.theme.background} 30%, rgba(255, 255, 255, 0)),
      linear-gradient(rgba(255, 255, 255, 0), ${p => p.theme.background} 70%) 0 100%,
      /* Shadows */ linear-gradient(to bottom, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0)),
      linear-gradient(to top, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0)) 0 100%;

    background-repeat: no-repeat;
    background-size:
      100% 40px,
      100% 40px,
      100% 20px,
      100% 20px;

    background-attachment: local, local, scroll, scroll;

    [data-matrix-mode='true'] & {
      background: #101e13;
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;
      padding: 6px;
      height: 500px;

      /* Custom scrollbar styling */
      &::-webkit-scrollbar {
        width: 8px;
      }

      &::-webkit-scrollbar-track {
        background: #0a150d;
        border: 1px solid #1a5200;
      }

      &::-webkit-scrollbar-thumb {
        background: #00ff00;
        border: 1px solid #1a5200;
      }

      &::-webkit-scrollbar-thumb:hover {
        background: #00cc00;
      }

      &::-webkit-scrollbar-corner {
        background: #0a150d;
        border: 1px solid #1a5200;
      }

      /* Firefox scrollbar */
      scrollbar-width: thin;
      scrollbar-color: #00ff00 #0a150d;
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

    [data-matrix-mode='true'] & {
      margin-top: 2px;

      + * {
        [cmdk-group-heading] {
          padding-top: 12px;
          border-top: 1px solid #1a5200;
        }
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

    [data-matrix-mode='true'] & {
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      font-weight: bold;
      font-size: 10px;
      padding-bottom: 4px;
      margin: 0 6px;
    }
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

    [data-matrix-mode='true'] & {
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;
      border: 1px solid transparent;
      padding: 6px 10px;
      font-size: 12px;
      border-radius: 0;
      margin: 0 -6px;

      ${IconWrapper} {
        transition: none;
      }

      &[data-selected='true'] {
        background-color: #00ff00;
        color: black;
        border-color: #00ff00;

        ${IconWrapper} {
          opacity: 1;
          transform: scale(1);
        }
      }
    }
  }

  [cmdk-empty] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: ${p => p.theme.fontSize.md};
    color: ${p => p.theme.subText};
    text-align: center;
    padding: 24px 12px;
    height: 400px;

    img {
      width: 100%;
      max-width: 400px;
      margin-bottom: 12px;
    }

    p {
      margin: 0;
    }

    [data-matrix-mode='true'] & {
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;

      img {
        filter: hue-rotate(120deg) brightness(1.5) contrast(1.2);
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

  [data-matrix-mode='true'] & {
    color: #00ff00;
    opacity: 0.75;
  }

  [data-selected='true'] & {
    [data-matrix-mode='true'] & {
      color: black;
    }
  }
`;

const OverflowHidden = styled('div')`
  overflow: hidden;
`;
