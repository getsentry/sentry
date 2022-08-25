export type NetworkSpan = {
  data: Record<string, any>;
  endTimestamp: number;
  op: string;
  startTimestamp: number;
  description?: string;
};

export interface ISortConfig<T extends object> {
  asc: boolean;
  by: keyof T | string;
  getValue: (row: T) => any;
}

export function sortNetwork<T extends object>(
  network: T[],
  sortConfig: ISortConfig<T>
): T[] {
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
