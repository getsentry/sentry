import {setExploreAttributeBounds} from 'sentry/views/explore/utils/setExploreAttributeBounds';

describe('setExploreAttributeBounds', () => {
  it('sets a range when there is no existing query', () => {
    expect(setExploreAttributeBounds('', 'value', 100, 200)).toBe(
      'value:>=100 value:<200'
    );
  });

  it('preserves other filters while setting the range', () => {
    expect(setExploreAttributeBounds('span.op:db', 'value', 100, 200)).toBe(
      'span.op:db value:>=100 value:<200'
    );
  });

  it('replaces an existing range on the same attribute instead of stacking it', () => {
    expect(setExploreAttributeBounds('value:>=0 value:<1000', 'value', 100, 200)).toBe(
      'value:>=100 value:<200'
    );
  });

  it('only touches the named attribute, leaving other bounds intact', () => {
    expect(setExploreAttributeBounds('duration:>=0 duration:<5', 'value', 100, 200)).toBe(
      'duration:>=0 duration:<5 value:>=100 value:<200'
    );
  });

  it('works for an arbitrary attribute, not just value', () => {
    expect(setExploreAttributeBounds('', 'duration', 1.5, 9)).toBe(
      'duration:>=1.5 duration:<9'
    );
  });
});
