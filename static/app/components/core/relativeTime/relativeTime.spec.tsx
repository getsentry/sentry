import {render, screen} from 'sentry-test/reactTestingLibrary';

import {type DateTimeContextValue, DateTimeProvider} from '@sentry/scraps/datetime';
import {RelativeTime} from '@sentry/scraps/relativeTime';

// 2026-07-29T06:40:00Z is 2026-07-28 11:40 PM in Los Angeles (PDT).
const DATE = '2026-07-29T06:40:00Z';

function renderInTimezone(
  children: NonNullable<React.ReactNode>,
  timezone: string,
  clockDisplay: DateTimeContextValue['clockDisplay'] = '12'
) {
  return render(
    <DateTimeProvider value={{timezone, clockDisplay}}>{children}</DateTimeProvider>
  );
}

describe('RelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-03-29T06:40:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the label and relative time in the header', () => {
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" suffix="ago" />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('8 months ago')).toBeInTheDocument();
  });

  it('renders no header when it has no label', () => {
    // Most timestamps in the app are already labelled by what they sit next to,
    // so the rows are the whole card.
    renderInTimezone(<RelativeTime date={DATE} suffix="ago" />, 'America/Los_Angeles');

    expect(screen.queryByText('8 months ago')).not.toBeInTheDocument();
    expect(screen.getByText('PDT')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
  });

  it('renders the viewer timezone and UTC rows', () => {
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('PDT')).toBeInTheDocument();
    expect(screen.getByText('Jul 28, 2026')).toBeInTheDocument();
    expect(screen.getByText('11:40 PM')).toBeInTheDocument();

    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getByText('Jul 29, 2026')).toBeInTheDocument();
    expect(screen.getByText('6:40 AM')).toBeInTheDocument();
  });

  it('follows the viewer timezone', () => {
    renderInTimezone(<RelativeTime date={DATE} label="Last Seen" />, 'Australia/Sydney');

    expect(screen.getByText('AEST')).toBeInTheDocument();
    expect(screen.getByText('4:40 PM')).toBeInTheDocument();
    // Sydney is a day ahead, so both rows land on the same calendar date
    expect(screen.getAllByText('Jul 29, 2026')).toHaveLength(2);
  });

  it('honors the 24 hour clock preference', () => {
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" />,
      'America/Los_Angeles',
      '24'
    );

    expect(screen.getByText('23:40')).toBeInTheDocument();
    expect(screen.getByText('06:40')).toBeInTheDocument();
  });

  it('shows seconds when asked', () => {
    // Spans in a trace are not identified by the minute alone, so dropping the
    // seconds the old tooltip showed would lose what the row is for.
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" showSeconds />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('11:40:00 PM')).toBeInTheDocument();
    expect(screen.getByText('6:40:00 AM')).toBeInTheDocument();
  });

  it('collapses to one row when the viewer is already in UTC', () => {
    renderInTimezone(<RelativeTime date={DATE} label="Last Seen" />, 'UTC');

    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getByText('Jul 29, 2026')).toBeInTheDocument();
    expect(screen.getByText('6:40 AM')).toBeInTheDocument();
  });

  it('keeps both rows for a zone that only shares UTC current offset', () => {
    // Reykjavik is GMT year round. Same instant as UTC, different label.
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" />,
      'Atlantic/Reykjavik'
    );

    expect(screen.getByText('GMT')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getAllByText('6:40 AM')).toHaveLength(2);
  });

  it('renders zones that have no abbreviation', () => {
    renderInTimezone(<RelativeTime date={DATE} label="Last Seen" />, 'Asia/Kathmandu');

    expect(screen.getByText('+0545')).toBeInTheDocument();
    expect(screen.getByText('12:25 PM')).toBeInTheDocument();
  });

  it('matches the trigger for dates in the future', () => {
    // The header must read the same as the <TimeSince> it expands on, which
    // defaults prefix to "in" — omitting it here must not print `undefined`.
    renderInTimezone(
      <RelativeTime
        date="2027-04-01T00:00:00Z"
        label="Last Seen"
        suffix="ago"
        unitStyle="short"
      />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('in 3d')).toBeInTheDocument();
  });

  it('matches the trigger by respecting unitStyle', () => {
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" suffix="ago" unitStyle="short" />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('8mo ago')).toBeInTheDocument();
  });
});
