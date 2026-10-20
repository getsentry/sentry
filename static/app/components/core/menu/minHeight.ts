/**
 * CompactSelect and DropdownMenu use this to cap a menu's requested height by
 * the available viewport height from its positioned overlay. An omitted height
 * leaves the other limit in place.
 */
export function minHeight(
  first: string | number | undefined,
  second: string | number | undefined
): string | number | undefined {
  if (first === undefined) {
    return second;
  }
  if (second === undefined) {
    return first;
  }
  const firstHeight = typeof first === 'number' ? `${first}px` : first;
  const secondHeight = typeof second === 'number' ? `${second}px` : second;
  return `min(${firstHeight}, ${secondHeight})`;
}
