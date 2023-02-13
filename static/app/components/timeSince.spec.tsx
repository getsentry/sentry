import {render, screen} from 'sentry-test/reactTestingLibrary';

import TimeSince from 'sentry/components/timeSince';

describe('TimeSince', function () {
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  it('renders a relative date', () => {
    const {rerender} = render(<TimeSince date={now} />);
    expect(screen.getByText('a few seconds ago')).toBeInTheDocument();
    rerender(<TimeSince date={tenMinAgo} />);
    expect(screen.getByText('10 minutes ago')).toBeInTheDocument();
  });

  it('renders a relative date without suffix', () => {
    render(<TimeSince date={tenMinAgo} suffix="" />);
    expect(screen.getByText('10 minutes')).toBeInTheDocument();
  });

  it('renders a shortened date', () => {
    render(<TimeSince unitStyle="short" date={tenMinAgo} />);
    expect(screen.getByText('10min ago')).toBeInTheDocument();
  });

  it('renders a extrashort date', () => {
    render(<TimeSince unitStyle="extraShort" date={tenMinAgo} />);
    expect(screen.getByText('10m ago')).toBeInTheDocument();
  });

  it('renders a spanish suffix', () => {
    render(<TimeSince date={tenMinAgo} suffix="atrás" />);
    expect(screen.getByText('10 minutes atrás')).toBeInTheDocument();
  });

  it('renders a spanish suffix with shortened', () => {
    render(<TimeSince unitStyle="extraShort" date={tenMinAgo} suffix="atrás" />);
    expect(screen.getByText('10m atrás')).toBeInTheDocument();
  });
});
