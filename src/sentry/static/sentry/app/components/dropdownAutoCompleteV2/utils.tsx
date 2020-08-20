// import flatMap from 'lodash/flatMap';

import {Item} from './types';

function filterItems(items: Array<Item>, inputValue: string) {
  return items.filter(
    item =>
      (item?.searchKey || `${item.value} ${item.label}`)
        .toLowerCase()
        .indexOf(inputValue.toLowerCase()) > -1
  );
}

// function filterGroupedItems(groups: Array<ItemWithSubItems>, inputValue: string) {
//   return groups
//     .map(group => ({
//       ...group,
//       items: filterItems(group.items, inputValue),
//     }))
//     .filter(group => group.items.length > 0);
// }

export function autoCompleteFilter(items: Array<Item>, inputValue: string): Array<Item> {
  if (!items) {
    return [];
  }

  if (items[0] && items[0]?.items) {
    // TODO
    return [];
    // const itemsWithSubItems = items as Array<ItemWithSubItems>;
    // const filteredGroupedItems = filterGroupedItems(itemsWithSubItems, inputValue);
    // return flatMap(filteredGroupedItems, (item: ItemWithSubItems) => {
    //   // Make sure we don't add the group label to list of items
    //   // if we try to hide it, otherwise it will render if the list
    //   // is using virtualized rows (because of fixed row heights)
    //   if (item.hideGroupLabel) {
    //     return item.items;
    //   }
    //   const p = [{...item, groupLabel: true}, ...item.items];
    //   return [];
    // });
  }

  return filterItems(items, inputValue);
}

export function getHeight(
  items: Array<Item>,
  maxHeight: number,
  virtualizedHeight: number
  // virtualizedLabelHeight?: number
) {
  // const minHeight = virtualizedLabelHeight
  //   ? items.reduce(
  //       (a, r) => a + (r.groupLabel ? virtualizedLabelHeight : virtualizedHeight),
  //       0
  //     )
  //   : items.length * virtualizedHeight;
  const minHeight = items.length * virtualizedHeight;
  return Math.min(minHeight, maxHeight);
}
