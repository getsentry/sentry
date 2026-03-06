import type {Tagged} from 'type-fest';

import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {LetterAvatar, type LetterAvatarProps} from './letterAvatar';

function makeConfiguration(
  initials: string,
  background: string,
  content: string
): LetterAvatarProps['configuration'] {
  return {
    initials: initials as Tagged<string, '__avatar'>,
    background: background as Tagged<string, '__avatar'>,
    content: content as Tagged<string, '__avatar'>,
  };
}

describe('LetterAvatar', () => {
  describe('initials rendering', () => {
    it.each([['JB'], ['J'], ['☃☃'], ['1'], ['?']])(
      'renders initials "%s" as passed',
      initials => {
        render(
          <LetterAvatar
            configuration={makeConfiguration(initials, '#ff0000', '#ffffff')}
          />
        );
        expect(screen.getByText(initials)).toBeInTheDocument();
      }
    );
  });

  describe('color rendering', () => {
    it('applies the provided background color to the rect', () => {
      render(
        <LetterAvatar configuration={makeConfiguration('JD', '#ff0000', '#ffffff')} />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });
});
