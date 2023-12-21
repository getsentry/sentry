import {Config as ConfigFixture} from 'sentry-fixture/config';
import {User} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import DateTime from 'sentry/components/dateTime';
import ConfigStore from 'sentry/stores/configStore';

describe('DateTime', () => {
  const user = User({
    options: {
      ...User().options,
      clock24Hours: false,
      timezone: 'America/Los_Angeles',
    },
  });

  beforeAll(() => {
    ConfigStore.loadInitialData(ConfigFixture({user}));
  });

  it('renders a date', () => {
    render(<DateTime date={new Date()} />);
    expect(screen.getByText('Oct 16, 7:41 PM')).toBeInTheDocument();
  });

  it('renders a date and shows the year if it is outside the current year', () => {
    const date = new Date();
    date.setFullYear(2016);
    date.setMonth(11);
    date.setDate(31);

    render(<DateTime date={date} />);
    expect(screen.getByText('Dec 31, 2016 7:41 PM')).toBeInTheDocument();
  });

  it('renders only the time', () => {
    render(<DateTime date={new Date()} timeOnly />);
    expect(screen.getByText('7:41 PM')).toBeInTheDocument();
  });

  it('renders only the date', () => {
    render(<DateTime date={new Date()} dateOnly />);
    expect(screen.getByText('Oct 16')).toBeInTheDocument();
  });

  it('renders a date with year', () => {
    render(<DateTime date={new Date()} year />);
    expect(screen.getByText('Oct 16, 2017 7:41 PM')).toBeInTheDocument();
  });

  it('renders a date with seconds', () => {
    render(<DateTime date={new Date()} seconds />);
    expect(screen.getByText('Oct 16, 7:41:20 PM')).toBeInTheDocument();
  });

  it('renders a date with the time zone', () => {
    render(<DateTime date={new Date()} timeZone />);
    expect(screen.getByText('Oct 16, 7:41 PM PDT')).toBeInTheDocument();
  });

  it('renders date with forced utc', () => {
    render(<DateTime date={new Date()} utc />);
    expect(screen.getByText('Oct 17, 2:41 AM UTC')).toBeInTheDocument();
  });

  it('renders date with forced timezone', () => {
    render(<DateTime date={new Date()} forcedTimezone="America/Toronto" />);
    expect(screen.getByText('Oct 16, 10:41 PM')).toBeInTheDocument();
  });

  describe('24 Hours', () => {
    beforeAll(() => {
      user.options.clock24Hours = true;
      ConfigStore.set('user', user);
    });

    afterAll(() => {
      user.options.clock24Hours = false;
      ConfigStore.set('user', user);
    });

    it('renders a date', () => {
      render(<DateTime date={new Date()} />);
      expect(screen.getByText('Oct 16, 19:41')).toBeInTheDocument();
    });

    it('renders only the time', () => {
      render(<DateTime date={new Date()} timeOnly />);
      expect(screen.getByText('19:41')).toBeInTheDocument();
    });

    it('renders date with forced utc', () => {
      render(<DateTime date={new Date()} utc />);
      expect(screen.getByText('Oct 17, 02:41 UTC')).toBeInTheDocument();
    });

    it('renders date with forced timezone', () => {
      render(<DateTime date={new Date()} forcedTimezone="America/Toronto" />);
      expect(screen.getByText('Oct 16, 22:41')).toBeInTheDocument();
    });
  });
});
