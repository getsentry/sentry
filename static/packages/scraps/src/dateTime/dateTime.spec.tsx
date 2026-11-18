import {render, screen} from '@testing-library/react';

import {
  configureFormatting,
  DateTime,
  DateTimeProvider,
  formatDateTime,
  type DateTimeOptions,
  useDateTimeFormatter,
} from '@sentry/scraps/dateTime';

const date = '2017-10-17T02:41:20.123Z';
let restore: () => void;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2017-10-17T02:41:20.000Z'));
  const snapshot = {
    timezone: 'America/Los_Angeles',
    clock: '12' as const,
    locale: 'en',
    messages: {
      t: (message: string) => message,
      tn: (singular: string, plural: string, count: number) =>
        Math.abs(count) === 1 ? singular : plural,
      pgettext: (_context: string, message: string) => message,
    },
  };
  restore = configureFormatting({getSnapshot: () => snapshot, subscribe: () => () => {}});
});

afterEach(() => {
  try {
    jest.runOnlyPendingTimers();
  } finally {
    jest.useRealTimers();
    restore();
  }
});

function FormattedWithHook({options}: {options: DateTimeOptions}) {
  const format = useDateTimeFormatter();
  return <span>{format(date, options)}</span>;
}

it.each([
  [{}, 'Oct 16, 7:41 PM'],
  [{mode: 'date'}, 'Oct 16'],
  [{mode: 'time'}, '7:41 PM'],
  [{year: 'always'}, 'Oct 16, 2017 7:41 PM'],
  [{precision: 'second'}, 'Oct 16, 7:41:20 PM'],
  [{precision: 'millisecond'}, 'Oct 16, 7:41:20.123 PM'],
  [{clock: '24', mode: 'time'}, '19:41'],
  [{clock: '24', precision: 'millisecond'}, 'Oct 16, 19:41:20.123'],
  [{showTimezone: true}, 'Oct 16, 7:41 PM PDT'],
  [{timezone: 'UTC'}, 'Oct 17, 2:41 AM UTC'],
  [{timezone: 'UTC', showTimezone: false}, 'Oct 17, 2:41 AM'],
  [{timezone: 'America/Toronto'}, 'Oct 16, 10:41 PM'],
] satisfies Array<[DateTimeOptions, string]>)(
  'shares the %j presentation between the component, hook, and plain formatter',
  (options, expected) => {
    render(
      <div>
        <DateTime date={date} {...options} />
        <FormattedWithHook options={options} />
      </div>
    );

    expect(formatDateTime(date, options)).toBe(expected);
    expect(screen.getAllByText(expected)).toHaveLength(2);
  }
);

it('binds the hook to local preferences and lets explicit options override them', () => {
  render(
    <DateTimeProvider value={{timezone: 'America/Toronto', clock: '24'}}>
      <DateTime date={date} mode="time" />
      <FormattedWithHook options={{mode: 'time'}} />
      <DateTime date={date} mode="time" timezone="UTC" clock="12" />
      <FormattedWithHook options={{mode: 'time', timezone: 'UTC', clock: '12'}} />
    </DateTimeProvider>
  );

  expect(screen.getAllByText('22:41')).toHaveLength(2);
  expect(screen.getAllByText('2:41 AM UTC')).toHaveLength(2);
  expect(formatDateTime(date, {mode: 'time'})).toBe('7:41 PM');
});

it('passes HTML attributes through to the time element', () => {
  render(<DateTime date={date} aria-label="Last seen" />);
  expect(screen.getByLabelText('Last seen')).toHaveTextContent('Oct 16, 7:41 PM');
});
