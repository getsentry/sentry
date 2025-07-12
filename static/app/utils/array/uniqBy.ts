export default function uniqueBy<Data extends Record<string, unknown>>(
  items: Data[],
  uniqueField: keyof Data
) {
  const uniqueIds = new Set(items.map(item => item[uniqueField]));
  return items.filter(item => {
    if (uniqueIds.has(item[uniqueField])) {
      uniqueIds.delete(item[uniqueField]);
      return true;
    }
    return false;
  });
}
