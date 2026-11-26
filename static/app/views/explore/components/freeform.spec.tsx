import {getFreeformName} from './freeform';

describe('getFreeformName', () => {
  it('returns the trimmed name when it is new', () => {
    expect(getFreeformName('  checkout.latency ', ['bar'])).toBe('checkout.latency');
  });

  it('returns null for an empty name', () => {
    expect(getFreeformName('   ', ['bar'])).toBeNull();
  });

  it('returns null for a name that already exists', () => {
    expect(getFreeformName('bar', ['bar'])).toBeNull();
  });

  it('treats names that differ only by case as existing', () => {
    expect(getFreeformName('Checkout.Latency', ['checkout.latency'])).toBeNull();
  });
});
