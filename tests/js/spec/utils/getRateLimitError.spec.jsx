import {getRateLimitError} from 'app/views/projectKeyDetails';

describe('getRateLimitError', function() {
  const errorObj = {
    rateLimit: [
      {
        foo: [],
        window: ['Ensure this value is less than or equal to 1440.'],
      },
      {
        bar: [],
        count: ['Ensure this value is greater than or equal to 3.'],
        window: ['Ensure this value is less than or equal to 1440.'],
      },
    ],
  };

  it('has no errors for keys: `foo` and `bar`', function() {
    expect(getRateLimitError(errorObj, 'foo')).toBe(false);
    expect(getRateLimitError(errorObj, 'bar')).toBe(false);
  });

  it('has an error for `window`', function() {
    expect(getRateLimitError(errorObj, 'window')).toBe(true);
  });

  it('has an error for `count`', function() {
    expect(getRateLimitError(errorObj, 'count')).toBe(true);
  });
});
