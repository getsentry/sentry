import {TOPK_COUNTS} from '../data';

/*
* Returns options for aggregation field dropdown
*/

export function getAggregateOptions(columns) {
  const topLevel = [
    {value: 'count', label: 'count'},
    {value: 'uniq', label: 'uniq(...)'},
    {value: 'topK', label: 'topK(...)'},
  ];

  const uniq = columns.map(({name}) => ({
    value: `uniq_${name}`,
    label: `uniq(${name})`,
  }));

  const topKCounts = TOPK_COUNTS.map(num => ({
    value: `topK_${num}`,
    label: `topK(${num})(...)`,
  }));

  const topKValues = TOPK_COUNTS.reduce((acc, num) => {
    return [
      ...acc,
      ...columns.map(({name}) => ({
        value: `topK_${num}_${name}`,
        label: `topK(${num})(${name})`,
      })),
    ];
  }, []);

  return {
    topLevel,
    uniq,
    topKCounts,
    topKValues,
  };
}

/*
* Converts from external representation (array) to internal format (string)
* for dropdown.
*/
export function getInternal(external) {
  const [func, col] = external;

  if (func === null) {
    return '';
  }

  if (func === 'count()') {
    return 'count';
  }

  if (func === 'uniq') {
    return `uniq_${col}`;
  }

  if (func.startsWith('topK')) {
    const count = func.match(/topK\((\d+)\)/)[1];
    return `topK_${count}_${col}`;
  }

  return func;
}

/*
* Converts from external representation (string value from dropdown) to external format (array)
*/
export function getExternal(internal) {
  const uniqRegex = /^uniq_(.+)$/;
  const topKRegex = /^topK_(\d+)_(.+)$/;

  if (internal === 'count') {
    return ['count()', null, 'count'];
  }

  if (internal.match(uniqRegex)) {
    return ['uniq', internal.match(uniqRegex)[1], internal];
  }

  const topKMatch = internal.match(topKRegex);
  if (topKMatch) {
    return [`topK(${parseInt(topKMatch[1], 10)})`, topKMatch[2], internal];
  }

  return internal;
}
