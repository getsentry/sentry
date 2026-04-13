import {NAMESPACE_SYMBOL} from 'sentry/actionCreators/savedSearches';

import {prettifyQueryConditions} from './prettifyQueryConditions';

describe('prettifyQueryConditions', () => {
  it('returns undefined for empty conditions', () => {
    expect(prettifyQueryConditions('')).toBeUndefined();
    expect(prettifyQueryConditions(undefined)).toBeUndefined();
  });

  it('converts Contains markers to *value*', () => {
    const contains = `${NAMESPACE_SYMBOL}Contains${NAMESPACE_SYMBOL}`;
    expect(prettifyQueryConditions(`transaction:${contains}issues`)).toBe(
      'transaction:*issues*'
    );
  });

  it('converts StartsWith markers to value*', () => {
    const startsWith = `${NAMESPACE_SYMBOL}StartsWith${NAMESPACE_SYMBOL}`;
    expect(prettifyQueryConditions(`transaction:${startsWith}issues`)).toBe(
      'transaction:issues*'
    );
  });

  it('converts EndsWith markers to *value', () => {
    const endsWith = `${NAMESPACE_SYMBOL}EndsWith${NAMESPACE_SYMBOL}`;
    expect(prettifyQueryConditions(`transaction:${endsWith}issues`)).toBe(
      'transaction:*issues'
    );
  });

  it('converts DoesNotContain markers to *value*', () => {
    const doesNotContain = `${NAMESPACE_SYMBOL}DoesNotContain${NAMESPACE_SYMBOL}`;
    expect(prettifyQueryConditions(`!transaction:${doesNotContain}issues`)).toBe(
      '!transaction:*issues*'
    );
  });

  it('passes through plain conditions unchanged', () => {
    expect(prettifyQueryConditions('browser:Chrome')).toBe('browser:Chrome');
  });

  it('handles multiple operators in a single conditions string', () => {
    const contains = `${NAMESPACE_SYMBOL}Contains${NAMESPACE_SYMBOL}`;
    const startsWith = `${NAMESPACE_SYMBOL}StartsWith${NAMESPACE_SYMBOL}`;
    expect(
      prettifyQueryConditions(`transaction:${contains}issues span.op:${startsWith}db`)
    ).toBe('transaction:*issues* span.op:db*');
  });
});
