import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {LetterAvatar} from './letterAvatar';

const DEFAULT_AVATAR_COLOR = {background: '#7c56de', content: '#fff'};

describe('LetterAvatar', () => {
  describe('initials rendering', () => {
    it.each([['JB'], ['J'], ['☃☃'], ['1'], ['?']])(
      'renders initials "%s" as passed',
      initials => {
        render(<LetterAvatar initials={initials} avatarColor={DEFAULT_AVATAR_COLOR} />);
        expect(screen.getByText(initials)).toBeInTheDocument();
      }
    );
  });

  describe('color rendering', () => {
    it('applies the provided background color to the rect', () => {
      render(
        <LetterAvatar
          initials="JD"
          avatarColor={{background: '#ff0000', content: '#ffffff'}}
        />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });
});
