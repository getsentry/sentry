import type {Item, ItemsAfterFilter, ItemsBeforeFilter} from './types';

type Items = ItemsBeforeFilter;
type ItemsWithChildren = (Omit<Item, 'index'> & {
  items: Omit<Item, 'index'>[];
  hideGroupLabel?: boolean;
})[];

function hasRootGroup(items: Items): items is ItemsWithChildren {
  return !!items[0]?.items;
}

function filterItems(items: Items, inputValue: string): ItemsBeforeFilter {
  return items.filter(item =>
    (typeof item.searchKey === 'string' && item.searchKey.length > 0
      ? item.searchKey
      : `${item.value} ${item.label}`
    )
      .toLowerCase()
      .includes(inputValue.toLowerCase())
  );
}

function filterGroupedItems(
  groups: ItemsWithChildren,
  inputValue: string
): ItemsWithChildren {
  return groups
    .map(group => ({
      ...group,
      items: filterItems(group.items, inputValue),
    }))
    .filter(group => group.items.length > 0);
}

function autoCompleteFilter(
  items: ItemsBeforeFilter | null,
  inputValue: string
): ItemsAfterFilter {
  let itemCount = 0;

  if (!items) {
    return [];
  }

  if (hasRootGroup(items)) {
    // if the first item has children, we assume it is a group
    return filterGroupedItems(items, inputValue).flatMap(item => {
      const groupItems = item.items.map(groupedItem => ({
        ...groupedItem,
        index: itemCount++,
      }));

      // Make sure we don't add the group label to list of items
      // if we try to hide it, otherwise it will render if the list
      // is using virtualized rows (because of fixed row heights)
      if (item.hideGroupLabel) {
        return groupItems;
      }

      return [{...item, groupLabel: true}, ...groupItems];
    }) as ItemsAfterFilter;
  }

  return filterItems(items, inputValue).map((item, index) => ({
    ...item,
    index,
  })) as ItemsAfterFilter;
}

export default autoCompleteFilter;
