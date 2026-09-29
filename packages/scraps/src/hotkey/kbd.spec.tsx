import {render, screen} from '../../test/env';

import {Kbd} from './kbd';

describe('Kbd', () => {
  it('renders a kbd element', () => {
    render(<Kbd>K</Kbd>);
    const el = screen.getByText('K');
    expect(el.tagName).toBe('KBD');
  });

  it('forwards className', () => {
    render(<Kbd className="custom">X</Kbd>);
    expect(screen.getByText('X')).toHaveClass('custom');
  });

  it('renders glyph characters', () => {
    render(<Kbd>{'\u2318'}</Kbd>);
    expect(screen.getByText('\u2318')).toBeInTheDocument();
  });
});
