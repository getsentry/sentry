import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {DateTime} from './dateTime';
import {TimezoneProvider} from './timezoneProvider';

describe('DateTime', () => {
  function renderPDT(child: React.ReactElement) {
    return render(
      <TimezoneProvider timezone="America/Los_Angeles">{child}</TimezoneProvider>
    );
  }

  it('renders a date', () => {
    renderPDT(<DateTime date={new Date()} />);
    expect(screen.getByText('Oct 16, 7:41 PM')).toBeInTheDocument();
  });

  it('renders a date and shows the year if it is outside the current year', () => {
    const date = new Date();
    date.setFullYear(2016);
    date.setMonth(11);
    date.setDate(31);

    renderPDT(<DateTime date={date} />);
    expect(screen.getByText('Dec 31, 2016 7:41 PM')).toBeInTheDocument();
  });

  it('renders only the time', () => {
    renderPDT(<DateTime date={new Date()} timeOnly />);
    expect(screen.getByText('7:41 PM')).toBeInTheDocument();
  });

  it('renders only the date', () => {
    renderPDT(<DateTime date={new Date()} dateOnly />);
    expect(screen.getByText('Oct 16')).toBeInTheDocument();
  });

  it('renders a date with year', () => {
    renderPDT(<DateTime date={new Date()} year />);
    expect(screen.getByText('Oct 16, 2017 7:41 PM')).toBeInTheDocument();
  });

  it('renders a date with seconds', () => {
    renderPDT(<DateTime date={new Date()} seconds />);
    expect(screen.getByText('Oct 16, 7:41:20 PM')).toBeInTheDocument();
  });

  it('renders a date with milliseconds', () => {
    renderPDT(<DateTime date={new Date()} milliseconds />);
    expect(screen.getByText('Oct 16, 7:41:20.000 PM')).toBeInTheDocument();
  });

  it('renders a date with seconds and milliseconds', () => {
    renderPDT(<DateTime date={new Date()} seconds milliseconds />);
    expect(screen.getByText('Oct 16, 7:41:20.000 PM')).toBeInTheDocument();
  });

  it('renders a date with the time zone', () => {
    renderPDT(<DateTime date={new Date()} timeZone />);
    expect(screen.getByText('Oct 16, 7:41 PM PDT')).toBeInTheDocument();
  });

  it('renders date with forced utc', () => {
    renderPDT(<DateTime date={new Date()} utc />);
    expect(screen.getByText('Oct 17, 2:41 AM UTC')).toBeInTheDocument();
  });

  it('renders date with forced timezone', () => {
    renderPDT(<DateTime date={new Date()} forcedTimezone="America/Toronto" />);
    expect(screen.getByText('Oct 16, 10:41 PM')).toBeInTheDocument();
  });

  describe('24 Hours', () => {
    beforeAll(() => {
      const user = UserFixture();
      user.options.clock24Hours = true;
      ConfigStore.set('user', user);
    });

    afterAll(() => {
      const user = UserFixture();
      user.options.clock24Hours = false;
      ConfigStore.set('user', user);
    });

    it('renders a date', () => {
      renderPDT(<DateTime date={new Date()} />);
      expect(screen.getByText('Oct 16, 19:41')).toBeInTheDocument();
    });

    it('renders only the time', () => {
      renderPDT(<DateTime date={new Date()} timeOnly />);
      expect(screen.getByText('19:41')).toBeInTheDocument();
    });

    it('renders a date with milliseconds', () => {
      renderPDT(<DateTime date={new Date()} milliseconds />);
      expect(screen.getByText('Oct 16, 19:41:20.000')).toBeInTheDocument();
    });

    it('renders a date with seconds and milliseconds', () => {
      renderPDT(<DateTime date={new Date()} seconds milliseconds />);
      expect(screen.getByText('Oct 16, 19:41:20.000')).toBeInTheDocument();
    });

    it('renders date with forced utc', () => {
      renderPDT(<DateTime date={new Date()} utc />);
      expect(screen.getByText('Oct 17, 02:41 UTC')).toBeInTheDocument();
    });

    it('renders date with forced timezone', () => {
      renderPDT(<DateTime date={new Date()} forcedTimezone="America/Toronto" />);
      expect(screen.getByText('Oct 16, 22:41')).toBeInTheDocument();
    });
  });
});
