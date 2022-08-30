import {defined} from 'sentry/utils';

export type Filters<T> = {
  [key: string]: (action: T) => boolean;
};

export const getFilteredItems = <T,>({
  filters,
  items,
  searchTerm,
  searchProp,
}: {
  filters: Filters<T>;
  items: T[];
  searchProp: keyof T;
  searchTerm: string;
}) => {
  if (!searchTerm && Object.keys(filters).length === 0) {
    return items;
  }

  const normalizedSearchTerm = searchTerm.toLowerCase();

  return items.filter(item => {
    let doesMatch = false;
    const searchValue = item[searchProp];

    if (defined(searchValue) && typeof searchValue === 'string') {
      doesMatch = searchValue?.toLowerCase().includes(normalizedSearchTerm) || false;
    }

    for (const key in filters) {
      if (filters.hasOwnProperty(key)) {
        const filter = filters[key];
        if (!filter(item)) {
          return false;
        }
      }
    }

    return doesMatch;
  });
};
