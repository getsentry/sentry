import React from 'react';
import TestUtils from 'react-addons-test-utils';
import UserLetterAvatar from 'app/components/userLetterAvatar';

describe('LetterAvatar', function() {
  const USER_1 = {
    id: 1,
    name: 'Jane Doe',
    email: 'janedoe@example.com'
  };
  const USER_2 = {
    id: 2,
    email: 'johnsmith@example.com'
  };
  const USER_3 = {
    id: 2,
    username: 'foo@example.com'
  };
  const USER_4 = {
    id: 2
  };
  const USER_5 = {
    ip_address: '127.0.0.1'
  };

  describe('getDisplayName()', function() {
    it('should set displayName based on name', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_1}/>);
      expect(this.letterAvatar.getDisplayName()).to.eql('Jane Doe');
    });

    it('should set displayName based on email', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_2}/>);
      expect(this.letterAvatar.getDisplayName()).to.eql('johnsmith@example.com');
    });

    it('should set displayName based on username', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_3}/>);
      expect(this.letterAvatar.getDisplayName()).to.eql('foo@example.com');
    });

    it('should set displayName to empty string if nothing useful', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_4}/>);
      expect(this.letterAvatar.getDisplayName()).to.eql('');
    });
  });


  describe('getIdentifier()', function() {
    it('should use email', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_1}/>);
      expect(this.letterAvatar.getIdentifier()).to.eql('janedoe@example.com');
    });

    it('should use username', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_3}/>);
      expect(this.letterAvatar.getIdentifier()).to.eql('foo@example.com');
    });

    it('should use id', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_4}/>);
      expect(this.letterAvatar.getIdentifier()).to.eql(2);
    });

    it('should use ip address', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<UserLetterAvatar user={USER_5}/>);
      expect(this.letterAvatar.getIdentifier()).to.eql('127.0.0.1');
    });
  });

});
