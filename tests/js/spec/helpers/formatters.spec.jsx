import {userDisplayName} from 'app/utils/formatters';

describe('formatters', function() {
  describe('userDisplayName', function() {
    it('should only show email, if name and email are the same', function() {
      expect(
        userDisplayName({
          name: 'foo@bar.com',
          email: 'foo@bar.com',
        })
      ).toEqual('foo@bar.com');
    });

    it('should show name + email, if name and email differ', function() {
      expect(
        userDisplayName({
          name: 'user',
          email: 'foo@bar.com',
        })
      ).toEqual('user (foo@bar.com)');
    });

    it('should show unknown author with email, if email is only provided', function() {
      expect(
        userDisplayName({
          email: 'foo@bar.com',
        })
      ).toEqual('Unknown author (foo@bar.com)');
    });

    it('should show unknown author, if author or email is just whitespace', function() {
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

    it('should show unknown author, if user object is either not an object or incomplete', function() {
      expect(userDisplayName()).toEqual('Unknown author');
      expect(userDisplayName({})).toEqual('Unknown author');
    });
  });
});
