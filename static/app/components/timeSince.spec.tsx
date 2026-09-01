import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider} from '@sentry/scraps/datetime';

import {getRelativeDate, TimeSince} from 'sentry/components/timeSince';

describe('TimeSince', () => {
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

  it('omits the affix that does not apply rather than printing it', () => {
    // Only one of prefix/suffix is ever used, so a caller that supplies just
    // one must not leak `undefined` when the other direction is taken.
    expect(getRelativeDate(futureTenMin, 'ago')).toBe('10 minutes');
    expect(getRelativeDate(pastTenMin, undefined, 'in')).toBe('10 minutes');
  });

  it('respects timezone in tooltip', async () => {
    const date = new Date('2024-01-15T12:00:00Z');
    render(
      <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '12'}}>
        <TimeSince date={date} />
      </DateTimeProvider>
    );
    const timeElement = screen.getByRole('time');
    await userEvent.hover(timeElement);
    expect(await screen.findByText(/E[SD]T/)).toBeInTheDocument();
  });

  describe('tooltip', () => {
    const date = new Date('2024-01-15T12:00:00Z');

    function renderInNewYork(element: React.ReactElement) {
      return render(
        <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '12'}}>
          {element}
        </DateTimeProvider>
      );
    }

    it('resolves every timestamp against UTC, labelled or not', async () => {
      // The card is what every TimeSince opens now, so the UTC row is there
      // whether or not the call site named the timestamp.
      renderInNewYork(<TimeSince date={date} />);

      await userEvent.hover(screen.getByRole('time'));

      expect(await screen.findByText('UTC')).toBeInTheDocument();
      expect(screen.getByText('7:00 AM')).toBeInTheDocument();
      expect(screen.getByText('12:00 PM')).toBeInTheDocument();
    });

    it('uses tooltipPrefix as the card header', async () => {
      renderInNewYork(<TimeSince date={date} tooltipPrefix="Last Seen" suffix="ago" />);

      await userEvent.hover(screen.getByRole('time'));

      expect(await screen.findByText('Last Seen')).toBeInTheDocument();
    });

    it('drops tooltipPrefix when a tooltipBody replaces the card', async () => {
      // The prefix heads the card, so a body that replaces the card leaves it
      // nothing to head. Asserted rather than left implicit, because it reads
      // as a prop quietly doing nothing.
      renderInNewYork(
        <TimeSince date={date} tooltipPrefix="Last Seen" tooltipBody={<p>Replaced</p>} />
      );

      await userEvent.hover(screen.getByRole('time'));

      expect(await screen.findByText('Replaced')).toBeInTheDocument();
      expect(screen.queryByText('Last Seen')).not.toBeInTheDocument();
    });

    it('shows seconds when the call site asks for them', async () => {
      renderInNewYork(<TimeSince date={date} tooltipShowSeconds />);

      await userEvent.hover(screen.getByRole('time'));

      expect(await screen.findByText('7:00:00 AM')).toBeInTheDocument();
    });

    it('lets a tooltipBody replace the card', async () => {
      renderInNewYork(<TimeSince date={date} tooltipBody={<span>Custom body</span>} />);

      await userEvent.hover(screen.getByRole('time'));

      expect(await screen.findByText('Custom body')).toBeInTheDocument();
      expect(screen.queryByText('UTC')).not.toBeInTheDocument();
    });

    it('renders no tooltip when the absolute one is disabled', async () => {
      renderInNewYork(<TimeSince date={date} disabledAbsoluteTooltip />);

      await userEvent.hover(screen.getByRole('time'));

      expect(screen.queryByText('UTC')).not.toBeInTheDocument();
    });
  });
});
