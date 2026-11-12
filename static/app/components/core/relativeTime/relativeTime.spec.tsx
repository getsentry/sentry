import {render, screen} from 'sentry-test/reactTestingLibrary';

import {type DateTimeContextValue, DateTimeProvider} from '@sentry/scraps/datetime';
import {RelativeTime} from '@sentry/scraps/relativeTime';

// Midnight UTC on New Year's Day, which is still the previous year in Los
// Angeles. Rows straddling a date boundary is the case the card exists for.
const DATE = '2026-01-01T00:00:00Z';

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
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T00:00:00Z'));
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
    expect(screen.getByText('PST')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
  });

  it('renders the viewer timezone and UTC rows', () => {
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('PST')).toBeInTheDocument();
    expect(screen.getByText('Dec 31, 2025')).toBeInTheDocument();
    expect(screen.getByText('4:00 PM')).toBeInTheDocument();

    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('12:00 AM')).toBeInTheDocument();
  });

  it('follows the viewer timezone', () => {
    renderInTimezone(<RelativeTime date={DATE} label="Last Seen" />, 'Australia/Sydney');

    expect(screen.getByText('AEDT')).toBeInTheDocument();
    expect(screen.getByText('11:00 AM')).toBeInTheDocument();
    // Midnight UTC is mid-morning in Sydney, so unlike Los Angeles both rows
    // land on the same calendar date
    expect(screen.getAllByText('Jan 1, 2026')).toHaveLength(2);
  });

  it('honors the 24 hour clock preference', () => {
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" />,
      'America/Los_Angeles',
      '24'
    );

    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('shows seconds when asked', () => {
    // Spans in a trace are not identified by the minute alone, so dropping the
    // seconds the old tooltip showed would lose what the row is for.
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" showSeconds />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('4:00:00 PM')).toBeInTheDocument();
    expect(screen.getByText('12:00:00 AM')).toBeInTheDocument();
  });

  it('collapses to one row when the viewer is already in UTC', () => {
    renderInTimezone(<RelativeTime date={DATE} label="Last Seen" />, 'UTC');

    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('12:00 AM')).toBeInTheDocument();
  });

  it('keeps both rows for a zone that only shares UTC current offset', () => {
    // Reykjavik is GMT year round. Same instant as UTC, different label.
    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" />,
      'Atlantic/Reykjavik'
    );

    expect(screen.getByText('GMT')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getAllByText('12:00 AM')).toHaveLength(2);
  });

  it('renders zones that have no abbreviation', () => {
    renderInTimezone(<RelativeTime date={DATE} label="Last Seen" />, 'Asia/Kathmandu');

    expect(screen.getByText('+0545')).toBeInTheDocument();
    expect(screen.getByText('5:45 AM')).toBeInTheDocument();
  });

  it('matches the trigger for dates in the future', () => {
    // The header must read the same as the <TimeSince> it expands on, which
    // defaults prefix to "in" — omitting it here must not print `undefined`.
    renderInTimezone(
      <RelativeTime
        date="2026-09-04T00:00:00Z"
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
