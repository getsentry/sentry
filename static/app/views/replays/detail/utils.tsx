export function filterItems<I extends object, K extends string>({
  filterFns,
  filterVals,
  items,
}: {
  filterFns: Record<K, (item: I, val: any) => boolean>;
  filterVals: Record<K, any>;
  items: undefined | I[];
}): I[] {
  return (
    items?.filter(item => {
      for (const key in filterFns) {
        const filter = filterFns[key];
        const val = filterVals[key];
        if (!filter(item, val)) {
          return false;
        }
      }
      return true;
    }) || []
  );
}

export function operationName(op: string) {
  return op.split('.')?.[1] ?? op;
}
