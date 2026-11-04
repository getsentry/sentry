import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render as rtlRender, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

function render(ui: React.ReactNode) {
  return rtlRender(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

import {ImageAvatar} from './imageAvatar';

describe('ImageAvatar', () => {
  it('renders image with the provided src and alt', () => {
    render(
      <ImageAvatar
        configuration={{
          src: 'https://example.com/avatar.jpg',
          alt: 'Jane Bloggs',
          ref: () => {},
        }}
      />
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Jane Bloggs');
  });
});
