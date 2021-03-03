import {Aggregation, Column} from '../types';

/**
 * Returns true if an aggregation is valid and false if not
 *
 * @param aggregation Aggregation in external Snuba format
 * @param cols List of column objects
 * @param cols.name Column name
 * @param cols.type Type of column
 * @returns True if valid aggregation, false if not
 */
export function isValidAggregation(aggregation: Aggregation, cols: Column[]): boolean {
  const columns = new Set(cols.map(({name}) => name));
  const [func, col] = aggregation;

  if (!func) {
    return false;
  }

  if (func === 'count()') {
    return !col;
  }

  if (func === 'uniq') {
    return columns.has(col || '');
  }

  if (func === 'avg' || func === 'sum') {
    const validCols = new Set(
      cols.filter(({type}) => type === 'number').map(({name}) => name)
    );
    return validCols.has(col || '');
  }

  return false;
}
