export const ALERTS = {
  duration: {
    aggregate: 'avg(d:spans/exclusive_time@millisecond)',
    query: 'span.module:db has:span.description',
  },
  spm: {
    aggregate: 'spm()',
    query: 'span.module:db has:span.description',
  },
};
