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
}

export function sortNetwork(
  network: NetworkSpan[],
  sortConfig: ISortConfig
): NetworkSpan[] {
  return [...network].sort((a, b) => {
    const valueA =
      (typeof a[sortConfig.by] === 'string'
        ? (a[sortConfig.by] as string).toUpperCase()
        : a[sortConfig.by]) || 0;

    const valueB =
      (typeof b[sortConfig.by] === 'string'
        ? (b[sortConfig.by] as string).toUpperCase()
        : b[sortConfig.by]) || 0;

    if (valueA === valueB) {
      return 0;
    }

    if (sortConfig.asc) {
      return valueA > valueB ? 1 : -1;
    }

    return valueB > valueA ? 1 : -1;
  });
}
