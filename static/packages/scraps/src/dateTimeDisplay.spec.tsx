import type * as React from 'react';
import {render, screen} from '@testing-library/react';

import {DateTime} from '@sentry/scraps/dateTime';
import {type DateTimeContextValue, DateTimeProvider} from '@sentry/scraps/datetime';

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2017-10-17T02:41:20.000Z'));
});
afterEach(() => {
  try {
    jest.runOnlyPendingTimers();
  } finally {
    jest.useRealTimers();
  }
});

describe('DateTime', () => {
  function renderPDT(
    child: React.ReactElement,
    {clockDisplay = '12'}: Partial<DateTimeContextValue> = {}
  ) {
    return render(
      <DateTimeProvider value={{timezone: 'America/Los_Angeles', clockDisplay}}>
        {child}
      </DateTimeProvider>
    );
  }

  it('renders a date', () => {
    renderPDT(<DateTime date={new Date()} />);
    expect(screen.getByText('Oct 16, 7:41 PM')).toBeInTheDocument();
  });

  it('renders a date and shows the year if it is outside the current year', () => {
    const date = new Date('2017-01-01T03:41:20.000Z');

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
    const on24HourClock = {clockDisplay: '24'} as const;

    it('renders a date', () => {
      renderPDT(<DateTime date={new Date()} />, on24HourClock);
      expect(screen.getByText('Oct 16, 19:41')).toBeInTheDocument();
    });

    it('renders only the time', () => {
      renderPDT(<DateTime date={new Date()} timeOnly />, on24HourClock);
      expect(screen.getByText('19:41')).toBeInTheDocument();
    });

    it('renders a date with milliseconds', () => {
      renderPDT(<DateTime date={new Date()} milliseconds />, on24HourClock);
      expect(screen.getByText('Oct 16, 19:41:20.000')).toBeInTheDocument();
    });

    it('renders a date with seconds and milliseconds', () => {
      renderPDT(<DateTime date={new Date()} seconds milliseconds />, on24HourClock);
      expect(screen.getByText('Oct 16, 19:41:20.000')).toBeInTheDocument();
    });

    it('renders date with forced utc', () => {
      renderPDT(<DateTime date={new Date()} utc />, on24HourClock);
      expect(screen.getByText('Oct 17, 02:41 UTC')).toBeInTheDocument();
    });

    it('renders date with forced timezone', () => {
      renderPDT(
        <DateTime date={new Date()} forcedTimezone="America/Toronto" />,
        on24HourClock
      );
      expect(screen.getByText('Oct 16, 22:41')).toBeInTheDocument();
    });
  });
});
