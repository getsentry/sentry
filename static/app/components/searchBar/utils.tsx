export function escapeTagValue(value: string): string {
  // Wrap in quotes if there is a space
  const isArrayTag = value.startsWith('[') && value.endsWith(']') && value.includes(',');
  return !isArrayTag && (value.includes(' ') || value.includes('"'))
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
}
