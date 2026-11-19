import type * as React from 'react';

import type {useResolveLinkHref} from '@sentry/scraps/link/linkBehaviorContext';

import type {MenuItemProps} from './item';

// react-aria uses the href prop on item state to determine if the item is a link
// and will navigate there when selected

/**
 * Recursively removes hidden items, including those nested in submenus
 * Apply href to items that have a to or externalHref prop
 */
export function removeHiddenItemsAndSetHref(
  source: MenuItemProps[],
  resolveHref: ReturnType<typeof useResolveLinkHref>
): MenuItemProps[] {
  return source
    .filter(item => !item.hidden)
    .map(item => {
      const href = item.to ? resolveHref(item.to) : item.externalHref;

      return {
        ...item,
        ...(href === undefined ? {} : {href}),
        ...(item.children
          ? {children: removeHiddenItemsAndSetHref(item.children, resolveHref)}
          : {}),
      };
    });
}

function isMenuItemHidden(search: string, label: React.ReactNode, textValue?: string) {
  const text = textValue ?? (typeof label === 'string' ? label : '');
  return Boolean(
    search && !text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
}

/** Items with children render as a section, unless they open a submenu. */
export function isMenuSection(item: MenuItemProps): boolean {
  return Boolean(item.children && item.children.length > 0 && !item.submenu);
}

export function filterMenuItems(items: MenuItemProps[], search: string): MenuItemProps[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) {
    return items;
  }

  return items.flatMap(item => {
    if (item.children && !item.submenu) {
      const children = filterMenuItems(item.children, query);
      return children.length > 0 ? [{...item, children}] : [];
    }

    return isMenuItemHidden(query, item.label, item.textValue) ? [] : [item];
  });
}

/**
 * Number of items a menu lists, counting the items inside sections but not
 * the sections themselves. Matches the count `DropdownMenuList` virtualizes by.
 */
export function countMenuItems(items: MenuItemProps[]): number {
  return items.reduce(
    (count, item) => count + (isMenuSection(item) ? (item.children?.length ?? 0) : 1),
    0
  );
}

/** The key of the menu item an event fired on, if it fired on one. */
export function getMenuItemKey(target: EventTarget | null): string | undefined {
  if (
    !(target instanceof HTMLElement) ||
    !target.getAttribute('role')?.startsWith('menuitem')
  ) {
    return undefined;
  }
  return target.dataset.key;
}

/**
 * Recursively finds and returns disabled items
 */
export function getDisabledKeys(source: MenuItemProps[]): Array<MenuItemProps['key']> {
  return source.reduce<Array<MenuItemProps['key']>>((acc, cur) => {
    if (cur.disabled) {
      // If an item is disabled, then its children will be inaccessible, so we
      // can skip them and just return the parent item
      acc.push(cur.key);
      return acc;
    }

    if (cur.children) {
      return acc.concat(getDisabledKeys(cur.children));
    }

    return acc;
  }, []);
}
