import {act, render, screen} from '@testing-library/react';

import {configureFormatting} from '@sentry/scraps/dateTime';
import {TranslationContextProvider} from '@sentry/scraps/translation';

import {getSnapshot} from '../dateTime/config';

import {getRelativeDate} from './getRelativeDate';
import {useRelativeTimeFormatter} from './useRelativeTimeFormatter';

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => {
  try {
    jest.runOnlyPendingTimers();
  } finally {
    jest.useRealTimers();
  }
});

it('preserves fuzzy thresholds and explicit affix overrides', () => {
  expect(getRelativeDate(new Date())).toBe('a few seconds ago');
  expect(getRelativeDate('2025-12-31T23:59:30Z')).toBe('a few seconds ago');
  expect(getRelativeDate('2025-12-31T23:59:00Z')).toBe('a minute ago');
  expect(getRelativeDate('2026-01-01T00:03:00Z')).toBe('in 3 minutes');
  expect(getRelativeDate('2026-01-01T00:03:00Z', {prefix: ''})).toBe('3 minutes');
  expect(getRelativeDate('2025-12-31T23:57:00Z', {suffix: 'elapsed'})).toBe(
    '3 minutes elapsed'
  );
  expect(
    getRelativeDate('2026-01-01T00:03:00Z', {rounding: 'unit', style: 'narrow'})
  ).toBe('in 3m');
  expect(getRelativeDate('not-a-date')).toBe('Invalid date');
  expect(getRelativeDate('2026-01-01')).toBe('Invalid date');
});

it('publishes one locale and complete translated phrase to React and plain callers', () => {
  const initial = getSnapshot();
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: onChange => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  });
  const date = '2025-12-31T23:59:58Z';
  function RelativeDate() {
    const format = useRelativeTimeFormatter();
    return <span>{format(date, {rounding: 'unit'})}</span>;
  }
  try {
    render(
      <TranslationContextProvider value={{t: () => 'unrelated UI text', tct: () => ''}}>
        <RelativeDate />
      </TranslationContextProvider>
    );
    expect(screen.getByText('2 seconds ago')).toBeInTheDocument();
    act(() => {
      snapshot = {
        ...initial,
        locale: 'fr',
        messages: {
          ...initial.messages,
          t: (message, ...args) => {
            const duration = typeof args[0] === 'string' ? args[0] : '';
            return message === '%s ago'
              ? `il y a ${duration}`
              : message === 'in %s'
                ? `dans ${duration}`
                : message;
          },
          tn: (singular, plural, count) =>
            singular === 'second'
              ? Math.abs(count) === 1
                ? 'seconde'
                : 'secondes'
              : plural,
        },
      };
      listeners.forEach(onChange => onChange());
    });
    expect(screen.getByText('il y a 2 secondes')).toBeInTheDocument();
    expect(getRelativeDate(date, {rounding: 'unit'})).toBe('il y a 2 secondes');
    expect(getRelativeDate(date)).toBe('il y a 2 secondes');
    expect(getRelativeDate('2026-01-01T00:00:02Z', {rounding: 'unit'})).toBe(
      'dans 2 secondes'
    );
    expect(getRelativeDate('2025-12-31T23:59:00Z')).toBe('il y a 1 minute');
    expect(getRelativeDate('2026-01-01T00:01:00Z')).toBe('dans 1 minute');
    expect(getRelativeDate('2025-12-31T23:59:00Z', {suffix: ''})).toBe('1 minute');
  } finally {
    restore();
  }
});

it.each([
  [44499, 'a few seconds'],
  [44500, 'a minute'],
  [89999, 'a minute'],
  [90000, '2 minutes'],
  [2669999, '44 minutes'],
  [2670000, 'an hour'],
  [5399999, 'an hour'],
  [5400000, '2 hours'],
  [77399999, '21 hours'],
  [77400000, 'a day'],
  [129599999, 'a day'],
  [129600000, '2 days'],
  [2203199999, '25 days'],
  [2203200000, 'a month'],
] as const)('preserves the fuzzy threshold at %sms', (milliseconds, body) => {
  expect(getRelativeDate(new Date(Date.now() - milliseconds))).toBe(`${body} ago`);
  expect(getRelativeDate(new Date(Date.now() + milliseconds))).toBe(`in ${body}`);
});

it('preserves calendar-month rounding from the beginning of a month', () => {
  expect(getRelativeDate('2026-02-15T00:00:00Z')).toBe('in a month');
  expect(getRelativeDate('2027-07-01T00:00:00Z')).toBe('in 2 years');
});

it('preserves calendar-month rounding and clamping from the end of a month', () => {
  jest.setSystemTime(new Date('2026-01-31T00:00:00Z'));
  expect(getRelativeDate('2026-03-17T00:00:00Z')).toBe('in 2 months');
  expect(getRelativeDate('2026-02-28T00:00:00Z')).toBe('in a month');
});

it('keeps a clamped eighteen-month interval at the two-year threshold', () => {
  jest.setSystemTime(new Date('2024-08-31T00:00:00Z'));
  expect(getRelativeDate('2026-02-28T00:00:00Z')).toBe('in 2 years');
});

it('uses elapsed hours across daylight saving changes', () => {
  jest.setSystemTime(new Date('2026-03-07T17:00:00Z'));
  const snapshot = {...getSnapshot(), timezone: 'America/New_York'};
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  });
  try {
    expect(getRelativeDate('2026-03-08T16:00:00Z')).toBe('in a day');
    expect(getRelativeDate('2026-03-09T16:00:00Z')).toBe('in 2 days');
  } finally {
    restore();
  }
});
