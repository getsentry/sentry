import {render, screen} from 'sentry-test/reactTestingLibrary';

import LetterAvatar from 'sentry/components/letterAvatar';

describe('LetterAvatar', function () {
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

  describe('display name', function () {
    it('should get initials based on name', function () {
      render(<LetterAvatar {...USER_1} />);
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('should get initials based on email', function () {
      render(<LetterAvatar {...USER_2} />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should get initials based on username', function () {
      render(<LetterAvatar {...USER_3} />);
      expect(screen.getByText('F')).toBeInTheDocument();
    });

    it('should show question mark if user has no display name', function () {
      render(<LetterAvatar {...USER_4} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should show question mark even if display name is a space', function () {
      render(<LetterAvatar {...USER_7} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should get initials based on name even if there are trailing spaces', function () {
      render(<LetterAvatar {...USER_6} />);
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('should not slice multibyte characters in half', function () {
      render(<LetterAvatar {...USER_8} />);
      expect(screen.getByText('\u2603\u2603')).toBeInTheDocument();
    });

    it('should pick most last name', function () {
      render(<LetterAvatar {...USER_9} />);
      expect(screen.getByText('JB')).toBeInTheDocument();
    });
  });

  describe('color', function () {
    it('should return a color based on email', function () {
      render(<LetterAvatar {...USER_1} />);
    });

    it('should return a color based on username', function () {
      render(<LetterAvatar {...USER_3} />);
    });

    it('should return a color based on id', function () {
      render(<LetterAvatar {...USER_4} />);
    });

    it('should return a color based on ip address', function () {
      render(<LetterAvatar {...USER_5} />);
    });
  });
});
