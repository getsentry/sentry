import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {RelativeTime} from '@sentry/scraps/relativeTime';

import {TimezoneProvider} from 'sentry/components/timezoneProvider';
import {ConfigStore} from 'sentry/stores/configStore';

// 2026-07-29T06:40:00Z is 2026-07-28 11:40 PM in Los Angeles (PDT).
const DATE = '2026-07-29T06:40:00Z';

function renderInTimezone(children: NonNullable<React.ReactNode>, timezone: string) {
  return render(<TimezoneProvider timezone={timezone}>{children}</TimezoneProvider>);
}

describe('RelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-03-29T06:40:00Z'));
    ConfigStore.set('user', UserFixture());
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
    const user = UserFixture();
    ConfigStore.set('user', {
      ...user,
      options: {...user.options, clock24Hours: true},
    });

    renderInTimezone(
      <RelativeTime date={DATE} label="Last Seen" />,
      'America/Los_Angeles'
    );

    expect(screen.getByText('23:40')).toBeInTheDocument();
    expect(screen.getByText('06:40')).toBeInTheDocument();
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
