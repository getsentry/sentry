export function splitIntoColumns<T>(items: T[], columnCount: number): T[][] {
  const columnSize = Math.ceil(items.length / columnCount);
  const columns: T[][] = [];
  for (let i = 0; i < items.length; i += columnSize) {
    columns.push(items.slice(i, i + columnSize));
  }
  return columns;
}
