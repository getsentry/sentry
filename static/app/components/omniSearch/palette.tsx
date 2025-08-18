import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';

import {closeModal} from 'sentry/actionCreators/modal';
import {useOmniSearchState} from 'sentry/components/omniSearch/useOmniSearchState';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import type {OmniAction} from './types';

/**
 * Very basic palette UI using cmdk that lists all registered actions.
 *
 * NOTE: This is intentionally minimal and will be iterated on.
 */
export function OmniSearchPalette({onBarrelRoll}: {onBarrelRoll: () => void}) {
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

  const funActions: OmniAction[] = useMemo(
    () => [
      {
        key: 'barrel-roll',
        label: 'Do a barrel roll! 🛩️',
        details: 'Spin 360 degrees',
        areaKey: 'system',
        actionIcon: undefined,
        hidden: false,
        disabled: false,
        onAction: () => {
          onBarrelRoll();
        },
      },
    ],
    [onBarrelRoll]
  );

  const grouped = useMemo(() => {
    const actions = [...availableActions, ...funActions].filter(
      (a: OmniAction) => !a.hidden
    );

    // Group by section label
    const bySection = new Map<string, OmniAction[]>();
    for (const action of actions) {
      const sectionLabel = action.section ?? '';
      const list = bySection.get(sectionLabel) ?? [];
      list.push(action);
      bySection.set(sectionLabel, list);
    }

    // Sort sections alphabetically by label
    const sectionKeys = Array.from(bySection.keys()).sort((a, b) => a.localeCompare(b));

    // Simple text filter across label/fullLabel/details
    const matches = (action: OmniAction) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        return true;
      }
      const parts: string[] = [];
      parts.push(action.label);
      if (action.fullLabel) {
        parts.push(action.fullLabel);
      }
      if (action.details) {
        parts.push(action.details);
      }
      return parts.join(' ').toLowerCase().includes(q);
    };

    return sectionKeys.map(sectionKey => {
      const label = sectionKey;
      const items = (bySection.get(sectionKey) ?? [])
        .filter(matches)
        .sort((a, b) => a.label.localeCompare(b.label));
      return {sectionKey, label, items};
    });
  }, [availableActions, funActions, query]);

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
      navigate(action.to);
    }

    // TODO: Any other action handlers?

    if (action.key === 'barrel-roll') {
      // Keep modal open for barrel roll
      return;
    }
    closeModal();
  };

  // When an action has been selected, clear the query and focus the input
  useEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [selectedAction]);

  return (
    <Container>
      <CommandPrimitive.Command label="OmniSearch" filter={() => 1}>
        <Header>
          {focusedArea && <div>{focusedArea.label}</div>}
          <CommandPrimitive.Command.Input
            ref={inputRef}
            autoFocus
            value={query}
            onValueChange={setQuery}
            onKeyDown={e => {
              if (e.key === 'Backspace' && query === '' && selectedAction) {
                clearSelection();
                e.preventDefault();
              }
            }}
            placeholder="Start typing…"
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
                              {item.actionIcon}
                            </IconDefaultsProvider>
                          )}
                          <span>{item.label}</span>
                        </ItemRow>
                      </CommandPrimitive.Command.Item>
                    ))}
                  </CommandPrimitive.Command.Group>
                )}
              </Fragment>
            ))
          )}
        </CommandPrimitive.Command.List>
      </CommandPrimitive.Command>
    </Container>
  );
}

const Container = styled('div')`
  width: 640px;
  max-width: 100%;
`;

const Header = styled('div')`
  padding: 8px;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ItemRow = styled('div')`
  display: flex;
  gap: 8px;
  align-items: center;
`;

export default OmniSearchPalette;
