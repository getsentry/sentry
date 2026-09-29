import {render, screen} from '@testing-library/react';

import {ThemeWrapper} from '../../test/theme';

import {Kbd} from './kbd';

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
