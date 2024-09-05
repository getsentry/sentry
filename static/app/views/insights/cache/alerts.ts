export const ALERTS = {
  missRate: {
    aggregate: 'cache_miss_rate()',
    query: 'span.op:[cache.get_item,cache.get]',
  },
  spm: {
    aggregate: 'spm()',
    query: 'span.op:[cache.get_item,cache.get]',
  },
  duration: {
    aggregate: 'avg(transaction.duration)',
  },
};
