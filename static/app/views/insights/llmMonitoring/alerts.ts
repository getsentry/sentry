export const ALERTS = {
  spm: {
    aggregate: 'spm()',
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
  },
  tokensUsed: {
    aggregate: 'sum(c:spans/ai.total_tokens.used@none)',
  },
};
