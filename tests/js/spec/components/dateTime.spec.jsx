import {render, screen} from 'sentry-test/reactTestingLibrary';

import DateTime from 'sentry/components/dateTime';
import ConfigStore from 'sentry/stores/configStore';

describe('DateTime', () => {
  const user = {
    ...TestStubs.User(),
    options: {
      clock24Hours: false,
      timezone: 'America/Los_Angeles',
    },
  };
  beforeAll(() => {
    ConfigStore.loadInitialData({user});
  });

  it('renders a date', () => {
    render(<DateTime date={new Date()} />);
    expect(screen.getByText('Oct 16, 2017 7:41:20 PM PDT')).toBeInTheDocument();
  });

  it('renders a date without seconds', () => {
    render(<DateTime date={new Date()} seconds={false} />);
    expect(screen.getByText('Oct 16, 2017 7:41 PM')).toBeInTheDocument();
  });

  it('renders timeonly', () => {
    render(<DateTime date={new Date()} timeOnly />);
    expect(screen.getByText('7:41 PM')).toBeInTheDocument();
  });

  it('renders dateOnly', () => {
    render(<DateTime date={new Date()} dateOnly />);
    expect(screen.getByText('October 16, 2017')).toBeInTheDocument();
  });

  it('renders shortDate', () => {
    render(<DateTime date={new Date()} shortDate />);
    expect(screen.getByText('10/16/2017')).toBeInTheDocument();
  });

  it('renders timeAndDate', () => {
    render(<DateTime date={new Date()} timeAndDate />);
    expect(screen.getByText('Oct 16, 7:41 PM')).toBeInTheDocument();
  });

  it('renders date with forced utc', () => {
    render(<DateTime date={new Date()} utc />);
    expect(screen.getByText('Oct 17, 2017 2:41:20 AM UTC')).toBeInTheDocument();
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
      expect(screen.getByText('Oct 16, 2017 19:41:20')).toBeInTheDocument();
    });

    it('renders timeonly', () => {
      render(<DateTime date={new Date()} timeOnly />);
      expect(screen.getByText('19:41')).toBeInTheDocument();
    });

    it('renders timeAndDate', () => {
      render(<DateTime date={new Date()} timeAndDate />);
      expect(screen.getByText('Oct 16, 19:41')).toBeInTheDocument();
    });

    it('renders date with forced utc', () => {
      render(<DateTime date={new Date()} utc />);
      expect(screen.getByText('Oct 17, 2017 02:41:20')).toBeInTheDocument();
    });
  });
});
