import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import TimeSince from 'sentry/components/timeSince';

describe('TimeSince', function () {
  const tenMinAgo = new Date(new Date().getTime() - 60000 * 10);
  it('renders a relative date', () => {
    const {rerender} = mountWithTheme(<TimeSince date={new Date()} />);
    expect(screen.getByText('a few seconds ago')).toBeInTheDocument();
    rerender(<TimeSince date={tenMinAgo} />);
    expect(screen.getByText('10 minutes ago')).toBeInTheDocument();
  });

  it('renders a relative date without suffix', () => {
    mountWithTheme(<TimeSince date={tenMinAgo} suffix="" />);
    expect(screen.getByText('10 minutes')).toBeInTheDocument();
  });

  it('renders a shortened date', () => {
    mountWithTheme(<TimeSince shorten date={tenMinAgo} />);
    expect(screen.getByText('10min ago')).toBeInTheDocument();
  });

  it('renders a extrashort date', () => {
    mountWithTheme(<TimeSince shorten extraShort date={tenMinAgo} />);
    expect(screen.getByText('10m ago')).toBeInTheDocument();
  });

  it('renders a spanish suffix', () => {
    mountWithTheme(<TimeSince date={tenMinAgo} suffix="atrás" />);
    expect(screen.getByText('10 minutes atrás')).toBeInTheDocument();
  });

  it('renders a spanish suffix with shortened', () => {
    mountWithTheme(<TimeSince shorten extraShort date={tenMinAgo} suffix="atrás" />);
    expect(screen.getByText('10m atrás')).toBeInTheDocument();
  });
});
