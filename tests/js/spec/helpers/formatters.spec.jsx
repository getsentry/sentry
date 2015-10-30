import {userDisplayName} from 'app/utils/formatters';

describe('formatters', function () {
  describe('userDisplayName', function () {
    it('should only show email, if name and email are the same', function () {
      expect(userDisplayName({
        name: 'foo@bar.com',
        email: 'foo@bar.com'
      })).to.eql('foo@bar.com');
    });

    it('should show name + email, if name and email differ', function () {
      expect(userDisplayName({
        name: 'user',
        email: 'foo@bar.com'
      })).to.eql('user (foo@bar.com)');
    });
  });
});
