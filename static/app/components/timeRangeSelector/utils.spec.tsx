import moment from 'moment-timezone';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider} from '@sentry/scraps/dateTime';

import {getAbsoluteSummary, getArbitraryRelativePeriod, parseStatsPeriod} from './utils';

describe('getArbitraryRelativePeriod', () => {
  it('parses a well-formed range of hours', () => {
    expect(getArbitraryRelativePeriod('2h')).toEqual({'2h': 'Last 2 hours'});
  });

  it('parses a well-formed range of days', () => {
    expect(getArbitraryRelativePeriod('14d')).toEqual({'14d': 'Last 14 days'});
  });

  it('rejects an malformed range', () => {
    expect(getArbitraryRelativePeriod('hello')).toEqual({});
  });

  it('rejects an unsupported range', () => {
    expect(getArbitraryRelativePeriod('14s')).toEqual({});
  });
});

describe('parseStatsPeriod', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2001-11-15T12:34:56.789Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses a range of hours', () => {
    const {start, end} = parseStatsPeriod('2h');

    expect(moment(end).diff(moment(start), 'hours')).toBe(2);
  });

  it('parses a range of seconds', () => {
    const {start, end} = parseStatsPeriod('3600s');

    expect(moment(end).diff(moment(start), 'seconds')).toBe(3600);
  });

  it('throws when the period is malformed', () => {
    expect(() => parseStatsPeriod('hello')).toThrow('Invalid stats period');
  });
});

describe('getAbsoluteSummary', () => {
  it('formats offset-less UTC page filters in UTC', () => {
    render(
      <React.Fragment>
        {getAbsoluteSummary('2025-01-01T01:00:00', '2025-01-02T02:00:00', true)}
      </React.Fragment>
    );

    expect(screen.getByText('Jan 1, 2025 1:00 AM UTC')).toBeInTheDocument();
    expect(screen.getByText('Jan 2, 2025 2:00 AM UTC')).toBeInTheDocument();
  });

  it('converts offset-less UTC page filters to the viewer timezone', () => {
    render(
      <DateTimeProvider value={{timezone: 'America/Los_Angeles'}}>
        {getAbsoluteSummary('2025-01-01T01:00:00', '2025-01-02T02:00:00')}
      </DateTimeProvider>
    );

    expect(screen.getByText('Dec 31, 2024 5:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2025 6:00 PM')).toBeInTheDocument();
  });
});
