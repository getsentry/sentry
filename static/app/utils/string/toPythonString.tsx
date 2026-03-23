/**
 * Converts a JS value to a string matching Python's str() output.
 * The backend converts group-by values using str(), so we need to
 * match that behavior for comparisons.
 */
export function toPythonString(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  if (Array.isArray(value)) {
    const items = value.map(item => {
      if (item === null || item === undefined) {
        return 'None';
      }
      if (typeof item === 'string') {
        return `'${item}'`;
      }
      return String(item);
    });
    return `[${items.join(', ')}]`;
  }
  return String(value);
}
