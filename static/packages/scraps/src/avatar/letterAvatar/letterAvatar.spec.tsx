import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render as rtlRender, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

function render(ui: React.ReactNode) {
  return rtlRender(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

import {LetterAvatar, type LetterAvatarProps} from './letterAvatar';

function makeConfiguration(
  initials: string,
  background: string,
  content: string
): LetterAvatarProps['configuration'] {
  return {
    initials,
    background,
    content,
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
