import {render, screen} from 'sentry-test/reactTestingLibrary';

import Count from 'sentry/components/count';

describe('Count', () => {
  it('renders formatted number', () => {
    render(<Count value={1000} />);
    expect(screen.getByText('1k')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<Count value="5000" />);
    expect(screen.getByText('5k')).toBeInTheDocument();
  });

  it('does not show capped indicator by default', () => {
    render(<Count value={2147483647} />);
    expect(screen.getByText('2.1b')).toBeInTheDocument();
    expect(screen.queryByText('2.1b+')).not.toBeInTheDocument();
  });

  it('shows capped indicator when value equals MAX_INT and showCappedIndicator is true', () => {
    render(<Count value={2147483647} showCappedIndicator />);
    expect(screen.getByText(/2\.1b\+/)).toBeInTheDocument();
  });

  it('does not show capped indicator when value is less than MAX_INT', () => {
    render(<Count value={2147483646} showCappedIndicator />);
    expect(screen.getByText('2.1b')).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('shows capped indicator for string MAX_INT value', () => {
    render(<Count value="2147483647" showCappedIndicator />);
    expect(screen.getByText(/2\.1b\+/)).toBeInTheDocument();
  });
});
