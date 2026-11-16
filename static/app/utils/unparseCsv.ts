import Papa from 'papaparse';

export function unparseCsv(data: Papa.UnparseObject<unknown[]>): string {
  return Papa.unparse(data, {escapeFormulae: /^\s*[=+\-@]/});
}
