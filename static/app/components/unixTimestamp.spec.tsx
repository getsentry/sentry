import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {UnixTimestamp} from 'sentry/components/unixTimestamp';

describe('UnixTimestamp', () => {
  it('shows the raw Unix value and reveals a human-readable card on hover', async () => {
    render(<UnixTimestamp value={1740787200.123} />);

    expect(screen.getByText('1740787200.123')).toBeInTheDocument();
    expect(screen.queryByText('Timestamp')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('1740787200.123'));

    expect(await screen.findByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
  });

  it('renders the fallback when the value is not a finite number', () => {
    render(<UnixTimestamp value="not-a-number" fallback={<span>raw</span>} />);

    expect(screen.getByText('raw')).toBeInTheDocument();
    expect(screen.queryByText('Timestamp')).not.toBeInTheDocument();
  });

  it('renders nothing when the value is invalid and no fallback is provided', () => {
    const {container} = render(<UnixTimestamp value={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
