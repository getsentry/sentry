import {
  getServerTransformations,
  hasOutliersTransformation,
  isCountLikeAggregate,
  OUTLIERS_TRANSFORMATION,
} from './outliersTransformation';

describe('outliersTransformation', () => {
  it('keeps outliers out of the transformations sent to the backend', () => {
    expect(
      getServerTransformations(['fill(zero)', OUTLIERS_TRANSFORMATION, 'smooth(sma,3)'])
    ).toEqual(['fill(zero)', 'smooth(sma,3)']);
  });

  it('returns the same array when there is nothing to remove', () => {
    const transformations = ['fill(zero)'];
    expect(getServerTransformations(transformations)).toBe(transformations);
  });

  it('detects the outliers transformation', () => {
    expect(hasOutliersTransformation([OUTLIERS_TRANSFORMATION])).toBe(true);
    expect(hasOutliersTransformation(['fill(zero)'])).toBe(false);
  });

  it.each([
    ['count(span.duration)', true],
    ['count_unique(user)', true],
    ['sum(span.duration)', true],
    ['epm()', true],
    ['p95(span.duration)', false],
    ['avg(span.duration)', false],
    ['failure_rate()', false],
    ['equation|count() / 2', false],
  ])('treats %s as count-like: %s', (yAxis, expected) => {
    expect(isCountLikeAggregate(yAxis)).toBe(expected);
  });
});
