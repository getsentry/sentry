export function formatApdex(value: number) {
  if (value === 0) {
    return '0';
  }

  if (value === 1) {
    return '1';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    roundingMode: 'trunc',
  });
}
