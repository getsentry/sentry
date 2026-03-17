import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StatusIndicator} from '@sentry/scraps/statusIndicator';

describe('StatusIndicator', () => {
  it('is hidden from the accessibility tree when no aria-label is provided', () => {
    render(<StatusIndicator variant="info" data-test-id="dot" />);
    expect(screen.getByTestId('dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role="img" and aria-label when aria-label is provided', () => {
    render(<StatusIndicator variant="info" aria-label="Online" data-test-id="dot" />);
    const dot = screen.getByRole('img', {name: 'Online'});
    expect(dot).toBeInTheDocument();
    expect(dot).not.toHaveAttribute('aria-hidden');
  });

  it('respects an explicit role override alongside aria-label', () => {
    render(
      <StatusIndicator
        variant="info"
        role="status"
        aria-label="Authentication Method Active"
        data-test-id="dot"
      />
    );
    const dot = screen.getByRole('status', {name: 'Authentication Method Active'});
    expect(dot).toBeInTheDocument();
    expect(dot).not.toHaveAttribute('aria-hidden');
  });
});
