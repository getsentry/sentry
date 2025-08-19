import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';

import {closeModal} from 'sentry/actionCreators/modal';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {IconSearch} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import type {OmniAction} from './types';
import {useApiDynamicActions} from './useApiDynamicActions';
import {useCommandDynamicActions} from './useCommandDynamicActions';
import {useFormDynamicActions} from './useFormDynamicActions';
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

  // Get dynamic actions from all sources (no filtering - palette handles the search)
  const apiActions = useApiDynamicActions(debouncedQuery);
  const formActions = useFormDynamicActions();
  const routeActions = useRouteDynamicActions();
  const orgActions = useOrganizationsDynamicActions();
  const commandActions = useCommandDynamicActions();

  // Combine all dynamic actions
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

  useEffect(() => {
    createFuzzySearch([...availableActions, ...dynamicActions], {
      keys: ['label', 'fullLabel', 'details'],
      getFn: strGetFn,
    }).then(f => {
      setFilteredAvailableActions(f.search(debouncedQuery).map(r => r.item));
    });
  }, [availableActions, debouncedQuery, dynamicActions]);

  const grouped = useMemo(() => {
    // Filter actions based on query
    const actions = debouncedQuery ? filteredAvailableActions : availableActions;

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
  }, [availableActions, debouncedQuery, filteredAvailableActions]);

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
  useEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [selectedAction]);

  return (
    <StyledCommand label="OmniSearch" shouldFilter={false}>
      <Header>
        {focusedArea && <div>{focusedArea.label}</div>}
        <IconSearch size="sm" style={{marginRight: 8}} />
        <CommandPrimitive.Command.Input
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
          placeholder="Search for projects, issues, settings, and more…"
        />
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
  );
}

const Header = styled('div')`
  position: relative;

  > *:first-child {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
  }
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  width: 18px;
`;

const StyledCommand = styled(CommandPrimitive.Command)`
  &[cmdk-root] {
    width: 100%;
    background: ${p => p.theme.background};
    border-radius: 6px;
    overflow: hidden;
    height: 520px;
  }

  [cmdk-input] {
    position: relative;
    background-color: ${p => p.theme.background};
    width: 100%;
    outline: none;
    border: none;
    padding: 16px 16px 16px 40px;
    border-bottom: 1px solid ${p => p.theme.border};
    font-size: ${p => p.theme.fontSize.lg};
    line-height: 1;
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
    transition: all 0.1s ease-out;

    &[data-selected='true'] {
      background-color: ${p => p.theme.backgroundSecondary};
      color: ${p => p.theme.purple400};

      ${IconWrapper} {
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

  > *:first-child {
    opacity: 0.75;
    transition: all 0.1s ease-out;
  }
`;

const ItemDetails = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis}
`;

const OverflowHidden = styled('div')`
  overflow: hidden;
`;
