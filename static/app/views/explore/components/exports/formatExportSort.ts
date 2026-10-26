export function formatExportSort(sort: {field: string; kind: 'asc' | 'desc'}) {
  return `${sort.kind === 'desc' ? '-' : ''}${sort.field}`;
}
