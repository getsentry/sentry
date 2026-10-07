export function splitIntoColumns<T>(
  items: T[],
  columnCount: number,
  getSize: (item: T) => number = () => 1
): T[][] {
  const total = items.reduce((sum, item) => sum + getSize(item), 0);
  const columnSize = Math.ceil(total / columnCount);
  const columns: T[][] = [];
  let column: T[] = [];
  let columnTotal = 0;

  for (const item of items) {
    if (columnTotal >= columnSize) {
      columns.push(column);
      column = [];
      columnTotal = 0;
    }
    column.push(item);
    columnTotal += getSize(item);
  }

  if (column.length > 0) {
    columns.push(column);
  }

  return columns;
}
