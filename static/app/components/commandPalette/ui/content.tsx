import {Fragment, useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';

import {Flex} from '@sentry/scraps/layout';

import {closeModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {COMMAND_PALETTE_GROUP_KEY_CONFIG} from 'sentry/components/commandPalette/ui/constants';
import {CommandPaletteList} from 'sentry/components/commandPalette/ui/list';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/useCommandPaletteState';
import type {MenuListItemProps} from 'sentry/components/core/menuListItem';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {unreachable} from 'sentry/utils/unreachable';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

type CommandPaletteActionMenuItem = MenuListItemProps & {
  children: CommandPaletteActionMenuItem[];
  key: string;
  hideCheck?: boolean;
};

function actionToMenuItem(
  action: CommandPaletteActionWithKey
): CommandPaletteActionMenuItem {
  return {
    key: action.key,
    label: action.display.label,
    details: action.display.details,
    leadingItems: action.display.icon ? (
      <IconWrap align="center" justify="center">
        {action.display.icon}
      </IconWrap>
    ) : undefined,
    children: action.type === 'group' ? action.actions.map(actionToMenuItem) : [],
    hideCheck: true,
  };
}

export function CommandPaletteContent() {
  const {actions, selectedAction, selectAction, clearSelection, query, setQuery} =
    useCommandPaletteState();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const groupedMenuItems = useMemo<CommandPaletteActionMenuItem[]>(() => {
    const itemsBySection = new Map<string, CommandPaletteActionMenuItem[]>();
    for (const action of actions) {
      const sectionLabel = action.groupingKey
        ? (COMMAND_PALETTE_GROUP_KEY_CONFIG[action.groupingKey]?.label ?? '')
        : '';
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
          children,
        };
      })
      .filter(section => section.children.length > 0);
  }, [actions]);

  const handleSelect = useCallback(
    (action: CommandPaletteActionWithKey) => {
      const actionType = action.type;
      switch (actionType) {
        case 'group':
          selectAction(action);
          return;
        case 'navigate':
          navigate(normalizeUrl(action.to));
          break;
        case 'callback':
          action.onAction();
          break;
        default:
          unreachable(actionType);
          break;
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
  width: ${() => SvgIcon.ICON_SIZES.md};
  height: ${() => SvgIcon.ICON_SIZES.md};
`;
