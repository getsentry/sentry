import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Count} from 'sentry/components/count';

describe('Count', () => {
  it('renders a number with a localized title', () => {
    render(<Count value={12345} />);
    expect(screen.getByText('12K')).toHaveAttribute('title', (12345).toLocaleString());
  });

  it('renders a numeric string with a localized title', () => {
    render(<Count value="12345" />);
    expect(screen.getByText('12K')).toHaveAttribute('title', (12345).toLocaleString());
  });

  it('falls back to the raw string for non-numeric values', () => {
    render(<Count value="abc" />);
    expect(screen.getByTitle('abc')).toBeInTheDocument();
  });

  it('does not throw when String.prototype.toLocaleString is patched', () => {
    const original = Object.getOwnPropertyDescriptor(String.prototype, 'toLocaleString');
    // oxlint-disable-next-line no-extend-native -- simulate a patched prototype
    Object.defineProperty(String.prototype, 'toLocaleString', {
      value: Number.prototype.toLocaleString,
      configurable: true,
      writable: true,
    });
    try {
      render(<Count value="500" />);
      expect(screen.getByText('500')).toHaveAttribute('title', (500).toLocaleString());
    } finally {
      if (original) {
        // oxlint-disable-next-line no-extend-native -- restore the original
        Object.defineProperty(String.prototype, 'toLocaleString', original);
      } else {
        delete (String.prototype as any).toLocaleString;
      }
    }
  });
});
