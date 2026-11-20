import {divide} from './divide';

describe('divide', () => {
  it('divides numbers safely', () => {
    expect(divide(81, 9)).toBe(9);
  });

  it('dividing by zero returns zero', () => {
    expect(divide(81, 0)).toBe(0);
  });
});
