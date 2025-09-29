import type {SearchGroup, SearchItem} from './types';

/**
 * Sets an item as active within a search group array and returns new search groups without mutating.
 * the item is compared via value, so this function assumes that each value is unique.
 */
export const getSearchGroupWithItemMarkedActive = (
  searchGroups: SearchGroup[],
  currentItem: SearchItem,
  active: boolean
): SearchGroup[] => {
  return searchGroups.map(group => ({
    ...group,
    children: group.children?.map(item => {
      if (item.value === currentItem.value && item.type === currentItem.type) {
        return {
          ...item,
          active,
        };
      }

      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: item.children.map(child => {
            if (child.value === currentItem.value && item.type === currentItem.type) {
              return {
                ...child,
                active,
              };
            }

            return child;
          }),
        };
      }

      return item;
    }),
  }));
};

export function escapeTagValue(value: string): string {
  // Wrap in quotes if there is a space
  const isArrayTag = value.startsWith('[') && value.endsWith(']') && value.includes(',');
  return (value.includes(' ') || value.includes('"')) && !isArrayTag
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
}
