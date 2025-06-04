import {render, screen} from 'sentry-test/reactTestingLibrary';

import TimeSince from 'sentry/components/timeSince';

describe('TimeSince', function () {
  const now = new Date();
  const pastFiveSec = new Date(now.getTime() - 5 * 1000);
  const pastTenMin = new Date(now.getTime() - 10 * 60 * 1000);
  const futureTenMin = new Date(now.getTime() + 10 * 60 * 1000);

  it('renders a human relative date', () => {
    const {rerender} = render(<TimeSince date={now} />);
    expect(screen.getByText('a few seconds ago')).toBeInTheDocument();
    rerender(<TimeSince date={pastTenMin} />);
    expect(screen.getByText('10 minutes ago')).toBeInTheDocument();
    rerender(<TimeSince date={futureTenMin} />);
    expect(screen.getByText('in 10 minutes')).toBeInTheDocument();
  });

  it('renders regular style', () => {
    render(<TimeSince date={pastFiveSec} unitStyle="regular" />);
    expect(screen.getByText('5 seconds ago')).toBeInTheDocument();
  });

  it('renders a shortened date', () => {
    render(<TimeSince unitStyle="short" date={pastTenMin} />);
    expect(screen.getByText('10min ago')).toBeInTheDocument();
  });

  it('renders a extrashort date', () => {
    render(<TimeSince unitStyle="extraShort" date={pastTenMin} />);
    expect(screen.getByText('10m ago')).toBeInTheDocument();
  });

  it('renders a relative date without suffix', () => {
    render(<TimeSince date={pastTenMin} suffix="" />);
    expect(screen.getByText('10 minutes')).toBeInTheDocument();
  });

  it('renders a relative date without prefix', () => {
    render(<TimeSince date={futureTenMin} prefix="" />);
    expect(screen.getByText('10 minutes')).toBeInTheDocument();
  });

  it('renders a custom suffix', () => {
    render(<TimeSince date={pastTenMin} suffix="until lunch" />);
    expect(screen.getByText('10 minutes until lunch')).toBeInTheDocument();
  });

  it('renders a custom prefix', () => {
    render(<TimeSince date={futureTenMin} prefix="lunch is in" />);
    expect(screen.getByText('lunch is in 10 minutes')).toBeInTheDocument();
  });

  it('renders a custom suffix with shortened', () => {
    render(<TimeSince unitStyle="extraShort" date={pastTenMin} suffix="atrás" />);
    expect(screen.getByText('10m atrás')).toBeInTheDocument();
  });
});
