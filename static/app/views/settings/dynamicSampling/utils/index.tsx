export function mapArrayToObject<T, V>({
  array,
  keySelector,
  valueSelector = (item: T) => item as any,
}: {
  array: T[];
  keySelector: (item: T) => string;
  valueSelector?: (item: T) => V;
}): Record<string, V> {
  return array.reduce<Record<string, V>>((acc, item) => {
    acc[keySelector(item)] = valueSelector(item);
    return acc;
  }, {});
}
