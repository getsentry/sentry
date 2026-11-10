import {useContext, useMemo, useState} from 'react';
import {Item, Section} from '@react-stately/collections';

import {useResolveLinkHref} from '@sentry/scraps/link/linkBehaviorContext';
import {DEFAULT_VIRTUALIZE_THRESHOLD} from '@sentry/scraps/useVirtualCollection';

import {DropdownMenuContext} from './context';
import type {DropdownMenuSearchOptions, MenuItemProps} from './item';
import type {DropdownMenuListProps} from './list';
import {DropdownMenuList} from './list';
import {
  countMenuItems,
  filterMenuItems,
  getDisabledKeys,
  isMenuSection,
  removeHiddenItemsAndSetHref,
} from './utils';

export type DropdownMenuContentProps = Omit<
  DropdownMenuListProps,
  'searchState' | 'isVirtualized'
> & {
  items: MenuItemProps[];
  search?: DropdownMenuSearchOptions;
};

export function DropdownMenuContent({
  items,
  disabledKeys,
  size,
  search,
  virtualizeThreshold,
  ...props
}: DropdownMenuContentProps) {
  // Updated in a transition by the search field, see `DropdownMenuSearch`.
  const [searchValue, setSearchValue] = useState('');
  // A submenu renders inside its parent menu's context, so it inherits the
  // parent's threshold unless it sets its own.
  const {virtualizeThreshold: inheritedVirtualizeThreshold} =
    useContext(DropdownMenuContext);
  const resolveHref = useResolveLinkHref();
  const activeItems = useMemo(
    () => removeHiddenItemsAndSetHref(items, resolveHref),
    [items, resolveHref]
  );
  const visibleItems = useMemo(
    () =>
      search && searchValue ? filterMenuItems(activeItems, searchValue) : activeItems,
    [activeItems, search, searchValue]
  );
  // Counts the items before a search filters them, so a menu keeps
  // virtualizing while it is searched: the matches of a long menu can still be
  // too many to render at once.
  const activeItemCount = useMemo(() => countMenuItems(activeItems), [activeItems]);
  const resolvedVirtualizeThreshold = virtualizeThreshold ?? inheritedVirtualizeThreshold;
  const isVirtualized =
    activeItemCount > (resolvedVirtualizeThreshold ?? DEFAULT_VIRTUALIZE_THRESHOLD);
  const defaultDisabledKeys = useMemo(
    () => getDisabledKeys(visibleItems),
    [visibleItems]
  );
  return (
    <DropdownMenuList
      {...props}
      size={size}
      disabledKeys={disabledKeys ?? defaultDisabledKeys}
      items={visibleItems}
      isVirtualized={isVirtualized}
      virtualizeThreshold={resolvedVirtualizeThreshold}
      searchState={
        search ? {...search, value: searchValue, onChange: setSearchValue} : undefined
      }
    >
      {(item: MenuItemProps) => {
        const {onAction: _onAction, ...itemProps} = item;

        if (isMenuSection(item)) {
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
