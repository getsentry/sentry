import {userDisplayName, getExactDuration} from 'app/utils/formatters';

describe('formatters', function () {
  describe('userDisplayName', function () {
    it('should only show email, if name and email are the same', function () {
      expect(
        userDisplayName({
          name: 'foo@bar.com',
          email: 'foo@bar.com',
        })
      ).toEqual('foo@bar.com');
    });

    it('should show name + email, if name and email differ', function () {
      expect(
        userDisplayName({
          name: 'user',
          email: 'foo@bar.com',
        })
      ).toEqual('user (foo@bar.com)');
    });

    it('should show unknown author with email, if email is only provided', function () {
      expect(
        userDisplayName({
          email: 'foo@bar.com',
        })
      ).toEqual('Unknown author (foo@bar.com)');
    });

    it('should show unknown author, if author or email is just whitespace', function () {
      expect(
        userDisplayName({
          // eslint-disable-next-line quotes
          name: `\t\n `,
        })
      ).toEqual('Unknown author');

      expect(
        userDisplayName({
          // eslint-disable-next-line quotes
          email: `\t\n `,
        })
      ).toEqual('Unknown author');
    });

    it('should show unknown author, if user object is either not an object or incomplete', function () {
      expect(userDisplayName()).toEqual('Unknown author');
      expect(userDisplayName({})).toEqual('Unknown author');
    });
  });

  describe('getExactDuration', () => {
    it('should provide default value', () => {
      expect(getExactDuration(0)).toEqual('0 milliseconds');
    });

    it('should format in the right way', () => {
      expect(getExactDuration(2.030043848568126)).toEqual('2 seconds 30 milliseconds');
      expect(getExactDuration(0.2)).toEqual('200 milliseconds');
      expect(getExactDuration(13)).toEqual('13 seconds');
      expect(getExactDuration(60)).toEqual('1 minute');
      expect(getExactDuration(121)).toEqual('2 minutes 1 second');
      expect(getExactDuration(234235435)).toEqual(
        '387 weeks 2 days 1 hour 23 minutes 55 seconds'
      );
    });

    it('should abbreviate label', () => {
      expect(getExactDuration(234235435, true)).toEqual('387wk 2d 1hr 23min 55s');
    });
  });
});
