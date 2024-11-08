import divide from 'sentry/utils/number/divide';

describe('divide', () => {
  it('divides numbers safely', () => {
    expect(divide(81, 9)).toEqual(9);
  });

  it('dividing by zero returns zero', () => {
    expect(divide(81, 0)).toEqual(0);
  });
});
