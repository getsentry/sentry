import floatFormat from 'app/utils/floatFormat';

describe('floatFormat()', function() {
  it('should format decimals', function() {
    expect(floatFormat(0, 0)).toBe(0);
    expect(floatFormat(10.513434, 1)).toBe(10.5);
    expect(floatFormat(10.513494, 3)).toBe(10.513);
  });
  it('should not round', function() {
    expect(floatFormat(10.513494, 4)).toBe(10.5134);
  });
});
