/**
 * Builds the search query for a heat map cell's "View connected spans" Explore
 * link: the cell's value-bucket filter, AND-combined with the widget's own
 * conditions (`baseQuery`).
 *
 * Search terms are space-AND'd, so a top-level `OR` in `baseQuery` (e.g.
 * `url:ABC OR url:XYZ`) would otherwise capture the appended value filter and
 * change the meaning. Wrapping `baseQuery` in parentheses keeps the two
 * fragments logically separate: `(url:ABC OR url:XYZ) value:>=5`.
 */
export function buildHeatmapCellQuery(
  baseQuery: string | undefined,
  valueMin: number,
  valueMax: number
): string {
  const valueQuery =
    valueMin === valueMax
      ? `value:<=${valueMin}`
      : `value:>=${valueMin} value:<${valueMax}`;

  return [baseQuery && `(${baseQuery})`, valueQuery].filter(Boolean).join(' ');
}
