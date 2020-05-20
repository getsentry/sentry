import React from 'react';

import {mount} from 'sentry-test/enzyme';

import LetterAvatar from 'app/components/letterAvatar';

describe('LetterAvatar', function() {
  const USER_1 = {
    identifier: 'janebloggs@example.com',
    displayName: 'Jane Bloggs',
  };
  const USER_2 = {
    identifier: 'johnsmith@example.com',
    displayName: 'johnsmith@example.com',
  };
  const USER_3 = {
    identifier: 'foo@example.com',
    displayName: 'foo@example.com',
  };
  const USER_4 = {
    identifier: '2',
    displayName: '',
  };
  const USER_5 = {
    identifier: '127.0.0.1',
    displayName: '',
  };
  const USER_6 = {
    identifier: 'janebloggs@example.com',
    displayName: 'Jane Bloggs ',
  };
  const USER_7 = {
    identifier: 'janebloggs@example.com',
    displayName: ' ',
  };
  const USER_8 = {
    identifier: 'janebloggs@example.com',
    displayName: '\u2603super \u2603duper',
  };
  const USER_9 = {
    identifier: 'janebloggs@example.com',
    displayName: 'jane austen bloggs',
  };

  describe('display name', function() {
    it('should get initials based on name', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_1} />);
      expect(letterAvatar.text()).toEqual('JB');
    });

    it('should get initials based on email', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_2} />);
      expect(letterAvatar.text()).toEqual('J');
    });

    it('should get initials based on username', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_3} />);
      expect(letterAvatar.text()).toEqual('F');
    });

    it('should show question mark if user has no display name', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_4} />);
      expect(letterAvatar.text()).toEqual('?');
    });

    it('should show question mark even if display name is a space', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_7} />);
      expect(letterAvatar.text()).toEqual('?');
    });

    it('should get initials based on name even if there are trailing spaces', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_6} />);
      expect(letterAvatar.text()).toEqual('JB');
    });

    it('should not slice multibyte characters in half', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_8} />);
      expect(letterAvatar.text()).toEqual('\u2603\u2603');
    });

    it('should pick most last name', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_9} />);
      expect(letterAvatar.text()).toEqual('JB');
    });
  });

  describe('color', function() {
    it('should return a color based on email', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_1} />);
      expect(letterAvatar.find('rect').props().fill).toEqual('#4e3fb4');
    });

    it('should return a color based on username', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_3} />);
      expect(letterAvatar.find('rect').props().fill).toEqual('#315cac');
    });

    it('should return a color based on id', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_4} />);
      expect(letterAvatar.find('rect').props().fill).toEqual('#57be8c');
    });

    it('should return a color based on ip address', function() {
      const letterAvatar = mount(<LetterAvatar {...USER_5} />);
      expect(letterAvatar.find('rect').props().fill).toEqual('#ec5e44');
    });
  });
});
