/**
 * Converts a JS value to a string matching Python's str() output.
 * The backend converts group-by values using str(), so we need to
 * match that behavior for comparisons.
 */
export function toPythonString(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  if (value === null || value === undefined) {
    return 'None';
  }
  if (Array.isArray(value)) {
    const items = value.map(item => {
      if (typeof item === 'string') {
        return `'${item}'`;
      }
      return toPythonString(item);
    });
    return `[${items.join(', ')}]`;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? 'None');
}
