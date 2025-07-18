import {trimTextCenter} from 'sentry/utils/string/trimTextCenter';
import {ELLIPSIS} from 'sentry/utils/string/unicode';

describe('trimTextCenter', () => {
  it('trims nothing if low > length', () => {
    expect(trimTextCenter('abc', 4)).toMatchObject({
      end: 0,
      length: 0,
      start: 0,
      text: 'abc',
    });
  });
  it('trims center perfectly', () => {
    expect(trimTextCenter('abcdef', 5.5)).toMatchObject({
      end: 4,
      length: 2,
      start: 2,
      text: `ab${ELLIPSIS}ef`,
    });
  });
  it('favors prefix length', () => {
    expect(trimTextCenter('abcdef', 5)).toMatchObject({
      end: 5,
      length: 3,
      start: 2,
      text: `ab${ELLIPSIS}f`,
    });
  });
});
