import {
  Children,
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  useContext,
} from 'react';
import {useMenu} from '@react-aria/menu';
import {Item} from '@react-stately/collections';
import {useTreeState, type TreeState} from '@react-stately/tree';
import type {CollectionChildren} from '@react-types/shared';

import {Container} from '@sentry/scraps/layout';

import {useMenuContext} from './context';
import {isMenuItemHidden, MenuCheckboxItem, MenuItem} from './item';
import {MenuSection} from './section';
import {MenuSubmenu} from './submenu';

const MenuListStateContext = createContext<TreeState<unknown> | null>(null);

export function useMenuListState() {
  const state = useContext(MenuListStateContext);
  if (!state) {
    throw new Error('Menu items must be used inside Menu.List');
  }
  return state;
}

/** Finds visible, enabled items belonging to this menu level. */
export function getMenuItems(list: HTMLUListElement | null): HTMLElement[] {
  if (!list) {
    return [];
  }
  return [...list.querySelectorAll<HTMLElement>('[role^="menuitem"]')].filter(
    item =>
      item.closest('[role="menu"]') === list &&
      !item.closest('[hidden]') &&
      item.getAttribute('aria-disabled') !== 'true'
  );
}

export interface MenuListProps extends React.HTMLAttributes<HTMLUListElement> {
  children: React.ReactNode;
}

/** Renders menu items and handles keyboard movement between them. */
export function MenuList({children, onKeyDown, ...props}: MenuListProps) {
  const {listRef, searchRef, goBack, search} = useMenuContext();
  const collectionItems: React.ReactElement[] = [];
  const disabledKeys: string[] = [];

  function prepareItems(nodes: React.ReactNode, prefix = ''): React.ReactNode {
    return Children.map(nodes, (child, index) => {
      if (!isValidElement(child)) {
        return child;
      }
      const key = `${prefix}${index}`;
      if (child.type === MenuSection || child.type === Fragment) {
        const section = child as React.ReactElement<{children: React.ReactNode}>;
        return cloneElement(section, {
          children: prepareItems(section.props.children, `${key}-`),
        });
      }
      if (
        child.type === MenuItem ||
        child.type === MenuCheckboxItem ||
        child.type === MenuSubmenu
      ) {
        const item = child as React.ReactElement<{
          label: React.ReactNode;
          disabled?: boolean;
          textValue?: string;
        }>;
        collectionItems.push(
          <Item
            key={key}
            textValue={
              item.props.textValue ??
              (typeof item.props.label === 'string' ? item.props.label : '')
            }
          >
            {item.props.label}
          </Item>
        );
        if (
          item.props.disabled ||
          isMenuItemHidden(search, item.props.label, item.props.textValue)
        ) {
          disabledKeys.push(key);
        }
        return cloneElement(item, {itemKey: key} as Partial<typeof item.props>);
      }
      return child;
    });
  }

  const preparedChildren = prepareItems(children);
  const state = useTreeState<unknown>({
    children: collectionItems as CollectionChildren<unknown>,
    disabledKeys,
    selectionMode: 'none',
  });
  const {menuProps} = useMenu(props, state, listRef);
  return (
    <MenuListStateContext value={state}>
      <Container
        as="ul"
        margin="0"
        padding="xs 0"
        overflowY="auto"
        overflowX="hidden"
        maxHeight="min(80vh, 400px)"
        {...props}
        {...menuProps}
        ref={listRef}
        role="menu"
        tabIndex={-1}
        onKeyDown={event => {
          onKeyDown?.(event);
          if (event.defaultPrevented) {
            return;
          }
          if (event.key === 'ArrowLeft' && goBack) {
            event.preventDefault();
            goBack();
            return;
          }
          if (event.key === 'ArrowUp' && searchRef.current) {
            const items = getMenuItems(listRef.current);
            if (items[0] === document.activeElement) {
              event.preventDefault();
              searchRef.current.focus();
              return;
            }
          }
          menuProps.onKeyDown?.(event);
        }}
      >
        {preparedChildren}
      </Container>
    </MenuListStateContext>
  );
}
