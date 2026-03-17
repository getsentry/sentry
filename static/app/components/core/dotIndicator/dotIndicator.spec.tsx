import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DotIndicator} from '@sentry/scraps/dotIndicator';

describe('DotIndicator', () => {
  it('is hidden from the accessibility tree when no aria-label is provided', () => {
    render(<DotIndicator variant="info" data-test-id="dot" />);
    expect(screen.getByTestId('dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role="img" and aria-label when aria-label is provided', () => {
    render(<DotIndicator variant="info" aria-label="Online" data-test-id="dot" />);
    const dot = screen.getByRole('img', {name: 'Online'});
    expect(dot).toBeInTheDocument();
    expect(dot).not.toHaveAttribute('aria-hidden');
  });

  it('respects an explicit role override alongside aria-label', () => {
    render(
      <DotIndicator
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
