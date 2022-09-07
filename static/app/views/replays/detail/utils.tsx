export type Filters<T> = {
  [key: string]: (item: T) => boolean;
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

    if (typeof searchValue === 'string') {
      doesMatch = searchValue.toLowerCase().includes(normalizedSearchTerm);
    } else {
      // As this is a generic typed value, we can't know for sure its value type. So we use JSON.stringify to make sure we get a string.
      doesMatch = JSON.stringify(searchValue)
        .toLowerCase()
        .includes(normalizedSearchTerm);
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
