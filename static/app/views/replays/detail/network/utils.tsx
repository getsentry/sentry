// Filter keys based on generic
type FilteredKeys<T, U> = {[P in keyof T]: T[P] extends U ? P : never}[keyof T];

export type NetworkSpan = {
  data: Record<string, any>;
  endTimestamp: number;
  op: string;
  startTimestamp: number;
  description?: string;
};

export interface ISortConfig {
  asc: boolean;
  by: keyof NetworkSpan;
  substractValue?: FilteredKeys<NetworkSpan, number>;
}

export function sortNetwork(
  network: NetworkSpan[],
  sortConfig: ISortConfig
): NetworkSpan[] {
  return [...network].sort((a, b) => {
    let valueA =
      (typeof a[sortConfig.by] === 'string'
        ? (a[sortConfig.by] as string).toUpperCase()
        : a[sortConfig.by]) || 0;

    let valueB =
      (typeof b[sortConfig.by] === 'string'
        ? (b[sortConfig.by] as string).toUpperCase()
        : b[sortConfig.by]) || 0;

    if (
      sortConfig.substractValue &&
      typeof valueA === 'number' &&
      typeof valueB === 'number'
    ) {
      valueA = valueA - a[sortConfig.substractValue];
      valueB = valueB - b[sortConfig.substractValue];
    }

    if (valueA === valueB) {
      return 0;
    }

    if (sortConfig.asc) {
      return valueA > valueB ? 1 : -1;
    }

    return valueB > valueA ? 1 : -1;
  });
}
