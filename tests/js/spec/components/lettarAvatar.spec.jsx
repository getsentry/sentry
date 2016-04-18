import React from 'react';
import TestUtils from 'react-addons-test-utils';
import LetterAvatar from 'app/components/letterAvatar';

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
  const USER_6 = {
    id: 1,
    name: 'Jane Doe ',
    email: 'janedoe@example.com'
  };
  const USER_7 = {
    id: 1,
    name: ' ',
    email: 'janedoe@example.com'
  };

  describe('getInitials()', function() {
    it('should get initials based on name', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_1}/>);
      expect(this.letterAvatar.getInitials()).to.eql('JD');
    });

    it('should get initials based on email', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_2}/>);
      expect(this.letterAvatar.getInitials()).to.eql('J');
    });

    it('should get initials based on username', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_3}/>);
      expect(this.letterAvatar.getInitials()).to.eql('F');
    });

    it('should show question mark if user has no display name', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_4}/>);
      expect(this.letterAvatar.getInitials()).to.eql('?');
    });

    it('should show question mark even if display name is a space', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_7}/>);
      expect(this.letterAvatar.getInitials()).to.eql('?');
    });

    it('should get initials based on name even if there are trailing spaces', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_6}/>);
      expect(this.letterAvatar.getInitials()).to.eql('JD');
    });
  });


  describe('getColor()', function() {
    it('should return a color based on email', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_1}/>);
      expect(this.letterAvatar.getColor()).to.eql('#E56AA6');
    });

    it('should return a color based on username', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_3}/>);
      expect(this.letterAvatar.getColor()).to.eql('#1D87CE');
    });

    it('should return a color based on id', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_4}/>);
      expect(this.letterAvatar.getColor()).to.eql('#6FBA57');
    });

    it('should return a color based on ip address', function() {
      this.letterAvatar = TestUtils.renderIntoDocument(<LetterAvatar user={USER_5}/>);
      expect(this.letterAvatar.getColor()).to.eql('#E35141');
    });
  });

});
