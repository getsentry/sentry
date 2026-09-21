/**
 * Splits groups of rows into roughly even columns without separating any group,
 * so a root row always stays in the same column as its branches.
 */
export function distributeRowGroupsIntoColumns<Row>(
  rowGroups: Row[][],
  columnCount: number
): Row[][][] {
  const rowTotal = rowGroups.reduce((sum, rowGroup) => sum + rowGroup.length, 0);
  const columnRowGoal = Math.ceil(rowTotal / columnCount);

  const columns: Row[][][] = [];
  let startIndex = 0;
  let runningTotal = 0;

  rowGroups.forEach((rowGroup, index) => {
    if (index === rowGroups.length - 1) {
      columns.push(rowGroups.slice(startIndex));
      return;
    }
    if (runningTotal >= columnRowGoal) {
      columns.push(rowGroups.slice(startIndex, index));
      runningTotal = 0;
      startIndex = index;
    }
    runningTotal += rowGroup.length;
  });

  return columns;
}
