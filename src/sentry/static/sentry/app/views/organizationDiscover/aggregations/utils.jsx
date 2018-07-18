/**
 * Returns true if an aggregation is valid and false if not
 *
 * @param {Array} aggregation Aggregation in external Snuba format
 * @param {Object} cols List of column objects
 * @param {String} cols.name Column name
 * @param {String} cols.type Type of column
 * @returns {Boolean} True if valid aggregatoin, false if not
 */
export function isValidAggregation(aggregation, cols) {
  const columns = new Set(cols.map(({name}) => name));
  const topKRegex = /topK\((\d+)\)/;

  const [func, col] = aggregation;

  if (!func) {
    return false;
  }

  if (func === 'count()') {
    return col === null;
  }

  if (func === 'uniq' || func.match(topKRegex)) {
    return columns.has(col);
  }

  if (func === 'avg') {
    const validCols = new Set(
      cols.filter(({type}) => type === 'number').map(({name}) => name)
    );
    return validCols.has(col);
  }

  return false;
}

/**
* Converts aggregation from external Snuba format to internal format for dropdown
*
* @param {Array} external Aggregation in external Snuba format
* @return {String} Aggregation in internal format
**/
export function getInternal(external) {
  const [func, col] = external;

  if (func === null) {
    return '';
  }

  if (func === 'count()') {
    return 'count';
  }

  if (func === 'uniq') {
    return `uniq(${col})`;
  }

  if (func === 'avg') {
    return `avg(${col})`;
  }

  if (func.startsWith('topK')) {
    const count = func.match(/topK\((\d+)\)/)[1];
    return `topK(${count})(${col})`;
  }

  return func;
}

/**
* Converts aggregation internal string format to external Snuba representation
*
* @param {String} internal Aggregation in internal format
* @return {Array} Aggregation in external Snuba format
*/
export function getExternal(internal) {
  const uniqRegex = /^uniq\((.+)\)$/;
  const avgRegex = /^avg\((.+)\)$/;
  const topKRegex = /^topK\((\d+)\)\((.+)\)$/;

  if (internal === 'count') {
    return ['count()', null, 'count'];
  }

  if (internal.match(uniqRegex)) {
    const column = internal.match(uniqRegex)[1];
    const tagMatch = column.match(/^tags\[(.+)]$/);
    const alias = tagMatch ? `tags_${tagMatch[1]}` : column;

    return ['uniq', column, `uniq_${alias}`];
  }

  if (internal.match(avgRegex)) {
    const column = internal.match(avgRegex)[1];
    return ['avg', column, `avg_${column}`];
  }

  const topKMatch = internal.match(topKRegex);
  if (topKMatch) {
    return [
      `topK(${parseInt(topKMatch[1], 10)})`,
      topKMatch[2],
      `topK_${topKMatch[1]}_${topKMatch[2]}`,
    ];
  }

  return internal;
}
