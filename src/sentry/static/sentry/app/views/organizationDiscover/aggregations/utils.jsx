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
  const topKRegex = /^topK\((\d+)\)\((.+)\)$/;

  if (internal === 'count') {
    return ['count()', null, 'count'];
  }

  if (internal.match(uniqRegex)) {
    const column = internal.match(uniqRegex)[1];
    return ['uniq', column, `uniq_${column}`];
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
