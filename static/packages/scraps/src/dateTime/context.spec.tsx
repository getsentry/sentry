import {act, render, screen} from '@testing-library/react';

import {
  configureFormatting,
  DateTime,
  DateTimeProvider,
  formatDateTime,
  type FormattingSnapshot,
  useClock,
  useTimezone,
} from './index';

function ShowPreferences() {
  const timezone = useTimezone();
  const clock = useClock();
  return <span>{`${timezone} / ${clock}`}</span>;
}

it('defaults to UTC on a 12 hour clock without a provider', () => {
  render(<ShowPreferences />);
  expect(screen.getByText('UTC / 12')).toBeInTheDocument();
});

it('inherits unspecified preferences from the nearest parent', () => {
  render(
    <DateTimeProvider value={{timezone: 'America/Halifax', clock: '24'}}>
      <DateTimeProvider value={{timezone: 'Australia/Eucla'}}>
        <ShowPreferences />
      </DateTimeProvider>
      <DateTimeProvider value={{clock: '12'}}>
        <ShowPreferences />
      </DateTimeProvider>
      <DateTimeProvider value={{timezone: undefined, clock: undefined}}>
        <ShowPreferences />
      </DateTimeProvider>
    </DateTimeProvider>
  );

  expect(screen.getByText('Australia/Eucla / 24')).toBeInTheDocument();
  expect(screen.getByText('America/Halifax / 12')).toBeInTheDocument();
  expect(screen.getByText('America/Halifax / 24')).toBeInTheDocument();
});

it('updates components and plain formatting from the same application snapshot', () => {
  let snapshot: FormattingSnapshot = {
    timezone: 'America/Los_Angeles',
    clock: '12',
    locale: 'en',
    messages: {
      t: message => message,
      tn: (singular, plural, count) => (Math.abs(count) === 1 ? singular : plural),
      pgettext: (_context, message) => message,
    },
  };
  const listeners = new Set<() => void>();
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: onChange => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  });
  const date = '2017-10-17T02:41:20.000Z';

  try {
    render(
      <DateTimeProvider value={{timezone: 'America/Toronto'}}>
        <DateTime date={date} mode="time" />
        <ShowPreferences />
      </DateTimeProvider>
    );
    expect(screen.getByText('10:41 PM')).toBeInTheDocument();
    expect(formatDateTime(date, {mode: 'time'})).toBe('7:41 PM');

    act(() => {
      snapshot = {...snapshot, clock: '24', timezone: 'UTC'};
      listeners.forEach(listener => listener());
    });

    expect(screen.getByText('22:41')).toBeInTheDocument();
    expect(screen.getByText('America/Toronto / 24')).toBeInTheDocument();
    expect(formatDateTime(date, {mode: 'time'})).toBe('02:41');
    expect(formatDateTime(date, {mode: 'time', timezone: 'UTC'})).toBe('02:41 UTC');
  } finally {
    restore();
  }
});
