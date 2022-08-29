export type NetworkSpan = {
  data: Record<string, any>;
  endTimestamp: number;
  op: string;
  startTimestamp: number;
  description?: string;
};

export type Filters = {
  [key: string]: (networkSpan: NetworkSpan) => boolean;
};

export interface ISortConfig {
  asc: boolean;
  by: keyof NetworkSpan | string;
  getValue: (row: NetworkSpan) => any;
}

export const UNKNOWN_STATUS = 'unknown';

export function sortNetwork(
  network: NetworkSpan[],
  sortConfig: ISortConfig
): NetworkSpan[] {
  return [...network].sort((a, b) => {
    let valueA = sortConfig.getValue(a);
    let valueB = sortConfig.getValue(b);

    valueA = typeof valueA === 'string' ? valueA.toUpperCase() : valueA;
    valueB = typeof valueB === 'string' ? valueB.toUpperCase() : valueB;

    if (valueA === valueB) {
      return 0;
    }

    if (sortConfig.asc) {
      return valueA > valueB ? 1 : -1;
    }

    return valueB > valueA ? 1 : -1;
  });
}

export const getResourceTypes = (networkSpans: NetworkSpan[]) =>
  Array.from(
    new Set<string>(
      networkSpans.map(networkSpan => networkSpan.op.replace('resource.', ''))
    )
  );

export const getStatusTypes = (networkSpans: NetworkSpan[]) =>
  Array.from(
    new Set<string | number>(
      networkSpans.map(networkSpan => networkSpan.data?.statusCode ?? UNKNOWN_STATUS)
    )
  );

export const getFilteredNetworkSpans = (
  networkSpans: NetworkSpan[],
  searchTerm: string,
  filters: Filters
) => {
  if (!searchTerm && Object.keys(filters).length === 0) {
    return networkSpans;
  }
  return networkSpans.filter(networkSpan => {
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const doesMatch = networkSpan.description
      ?.toLowerCase()
      .includes(normalizedSearchTerm);

    for (const key in filters) {
      if (filters.hasOwnProperty(key)) {
        const filter = filters[key];
        if (!filter(networkSpan)) {
          return false;
        }
      }
    }

    return doesMatch;
  });
};
