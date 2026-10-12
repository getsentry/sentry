import {useMemo} from 'react';
import {Item, Section} from '@react-stately/collections';
import type {LocationDescriptor} from 'history';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

import type {MenuItemProps} from './item';
import {DropdownMenuList, type DropdownMenuListProps} from './list';

// react-aria uses the href prop on item state to determine if the item is a link
// and will navigate there when selected
function makeItemHref(item: MenuItemProps): LocationDescriptor | undefined {
  if (item.to) {
    // This matches the behavior of the Link component
    return normalizeUrl(item.to);
  }

  return item.externalHref;
}

/**
 * Recursively removes hidden items, including those nested in submenus
 * Apply href to items that have a to or externalHref prop
 */
function removeHiddenItemsAndSetHref(source: MenuItemProps[]): MenuItemProps[] {
  return source
    .filter(item => !item.hidden)
    .map(item => {
      const href = makeItemHref(item);

      return {
        ...item,
        ...(href === undefined ? {} : {href}),
        ...(item.children ? {children: removeHiddenItemsAndSetHref(item.children)} : {}),
      };
    });
}

/**
 * Recursively finds and returns disabled items
 */
function getDisabledKeys(source: MenuItemProps[]): Array<MenuItemProps['key']> {
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

type DropdownMenuContentProps = DropdownMenuListProps & {items: MenuItemProps[]};

export function DropdownMenuContent({
  items,
  disabledKeys,
  size,
  ...props
}: DropdownMenuContentProps) {
  const activeItems = useMemo(() => removeHiddenItemsAndSetHref(items), [items]);
  const defaultDisabledKeys = useMemo(() => getDisabledKeys(activeItems), [activeItems]);

  return (
    <DropdownMenuList
      {...props}
      size={size}
      disabledKeys={disabledKeys ?? defaultDisabledKeys}
      items={activeItems}
    >
      {(item: MenuItemProps) => {
        const {onAction: _onAction, ...itemProps} = item;

        if (item.children && item.children.length > 0 && !item.submenu) {
          return (
            <Section key={item.key} title={item.label} items={item.children}>
              {sectionItem => {
                const {onAction: _sectionOnAction, ...sectionItemProps} = sectionItem;

                return (
                  <Item size={size} {...sectionItemProps} key={sectionItem.key}>
                    {sectionItem.label}
                  </Item>
                );
              }}
            </Section>
          );
        }
        return (
          <Item size={size} {...itemProps} key={item.key}>
            {item.label}
          </Item>
        );
      }}
    </DropdownMenuList>
  );
}
