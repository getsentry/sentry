import {Fragment, useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';

import {Flex} from '@sentry/scraps/layout';

import {closeModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {CommandPaletteList} from 'sentry/components/commandPalette/ui/list';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/useCommandPaletteState';
import type {MenuListItemProps} from 'sentry/components/core/menuListItem';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

type CommandPaletteActionMenuItem = MenuListItemProps & {
  children: CommandPaletteActionMenuItem[];
  key: string;
  hideCheck?: boolean;
};

// We need to limit the number of displayed actions for performance reasons
// TODO: Consider other options, like limiting large sections directly or virtualizing the list
const MAX_ACTIONS_PER_SECTION = 10;

function actionToMenuItem(action: CommandPaletteAction): CommandPaletteActionMenuItem {
  return {
    key: action.key,
    label: action.label,
    details: action.details,
    leadingItems: action.icon ? (
      <IconWrap align="center" justify="center">
        {action.icon}
      </IconWrap>
    ) : undefined,
    children:
      action.actions?.slice(0, MAX_ACTIONS_PER_SECTION).map(actionToMenuItem) ?? [],
    hideCheck: true,
  };
}

export function CommandPaletteContent() {
  const {actions, selectedAction, selectAction, clearSelection, query, setQuery} =
    useCommandPaletteState();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const groupedMenuItems = useMemo<CommandPaletteActionMenuItem[]>(() => {
    // Group by section label
    const itemsBySection = new Map<string, CommandPaletteActionMenuItem[]>();
    for (const action of actions) {
      const sectionLabel = action.groupingKey ?? '';
      const list = itemsBySection.get(sectionLabel) ?? [];
      list.push(actionToMenuItem(action));
      itemsBySection.set(sectionLabel, list);
    }

    return Array.from(itemsBySection.keys())
      .map((sectionKey): CommandPaletteActionMenuItem => {
        const children = itemsBySection.get(sectionKey) ?? [];
        return {
          key: sectionKey,
          label: sectionKey,
          children: children.slice(0, MAX_ACTIONS_PER_SECTION),
        };
      })
      .filter(section => section.children.length > 0);
  }, [actions]);

  const handleSelect = useCallback(
    (action: CommandPaletteAction) => {
      // If there are child actions, we want to select the parent action and show the children
      if (action.actions && action.actions.length > 0) {
        selectAction(action);
        return;
      }
      if (action.onAction) {
        action.onAction();
      }
      if (action.to) {
        navigate(normalizeUrl(action.to));
      }
      closeModal();
    },
    [navigate, selectAction]
  );

  const handleActionByKey = useCallback(
    (selectionKey: React.Key | null | undefined) => {
      if (selectionKey === null || selectionKey === undefined) {
        return;
      }
      const action = actions.find(a => a.key === selectionKey);
      if (action) {
        handleSelect(action);
      }
    },
    [actions, handleSelect]
  );

  // When an action has been selected, clear the query and focus the input
  useLayoutEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [selectedAction, setQuery]);

  return (
    <Fragment>
      <CommandPaletteList
        onActionKey={handleActionByKey}
        inputRef={inputRef}
        query={query}
        setQuery={setQuery}
        clearSelection={clearSelection}
        selectedAction={selectedAction}
      >
        {groupedMenuItems.map(({key: sectionKey, label, children}) => (
          <Section key={sectionKey} title={label}>
            {children.map(({key: actionKey, ...action}) => (
              <Item<CommandPaletteActionMenuItem> key={actionKey} {...action}>
                {action.label}
              </Item>
            ))}
          </Section>
        ))}
      </CommandPaletteList>
    </Fragment>
  );
}

const IconWrap = styled(Flex)`
  width: ${p => p.theme.iconSizes.md};
  height: ${p => p.theme.iconSizes.md};
`;
