import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

import {Kbd} from './kbd';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Kbd', () => {
  it('renders a kbd element', () => {
    render(<Kbd>K</Kbd>, {wrapper: ThemeWrapper});
    const el = screen.getByText('K');
    expect(el.tagName).toBe('KBD');
  });

  it('forwards className', () => {
    render(<Kbd className="custom">X</Kbd>, {wrapper: ThemeWrapper});
    expect(screen.getByText('X')).toHaveClass('custom');
  });

  it('renders glyph characters', () => {
    render(<Kbd>{'\u2318'}</Kbd>, {wrapper: ThemeWrapper});
    expect(screen.getByText('\u2318')).toBeInTheDocument();
  });
});
