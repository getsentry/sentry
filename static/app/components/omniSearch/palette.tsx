import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';

import {useOmniSearchStore} from './context';
import type {OmniAction} from './types';

/**
 * Very basic palette UI using cmdk that lists all registered actions.
 *
 * NOTE: This is intentionally minimal and will be iterated on.
 */
export function OmniSearchPalette() {
  const {actionsByKey, areasByKey, areaPriority} = useOmniSearchStore();
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const actions = Array.from(actionsByKey.values()).filter(a => !a.hidden);

    const byArea = new Map<string, OmniAction[]>();
    for (const action of actions) {
      const list = byArea.get(action.areaKey) ?? [];
      list.push(action);
      byArea.set(action.areaKey, list);
    }

    const sortAreaKeys = () => {
      const existingKeys = new Set(byArea.keys());
      const prioritized = areaPriority.filter(k => existingKeys.has(k));
      const remaining = Array.from(existingKeys).filter(k => !prioritized.includes(k));
      remaining.sort((a, b) => {
        const aLabel = areasByKey.get(a)?.label ?? a;
        const bLabel = areasByKey.get(b)?.label ?? b;
        return aLabel.localeCompare(bLabel);
      });
      return [...prioritized, ...remaining];
    };

    const areaKeys = sortAreaKeys();

    // Simple text filter across label/fullLabel/details
    const matches = (action: OmniAction) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        return true;
      }
      const parts: string[] = [];
      if (typeof action.label === 'string') parts.push(action.label);
      if (typeof action.details === 'string') parts.push(action.details);
      return parts.join(' \n ').toLowerCase().includes(q);
    };

    return areaKeys.map(areaKey => {
      const label = areasByKey.get(areaKey)?.label ?? areaKey;
      const items = (byArea.get(areaKey) ?? [])
        .filter(matches)
        .sort((a, b) => a.label.localeCompare(b.label));
      return {areaKey, label, items};
    });
  }, [actionsByKey, areasByKey, areaPriority, query]);

  const handleSelect = (action: OmniAction) => {
    if (action.disabled) {
      return;
    }
    if (action.onAction) {
      action.onAction();
    }

    // TODO: Any other action handlers?
  };

  return (
    <Container>
      <CommandPrimitive.Command label="OmniSearch" filter={() => 1}>
        <Header>
          <CommandPrimitive.Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Start typing…"
          />
        </Header>
        <CommandPrimitive.Command.List>
          {grouped.every(g => g.items.length === 0) ? (
            <CommandPrimitive.Command.Empty>No results</CommandPrimitive.Command.Empty>
          ) : (
            grouped.map(group => (
              <Fragment key={group.areaKey}>
                {group.items.length > 0 && (
                  <CommandPrimitive.Command.Group heading={group.label}>
                    {group.items.map(item => (
                      <CommandPrimitive.Command.Item
                        key={item.key}
                        onSelect={() => handleSelect(item)}
                        disabled={item.disabled}
                      >
                        <ItemRow>
                          {item.actionIcon && <item.actionIcon size="sm" />}
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
