import {act, render, screen} from '@testing-library/react';
import moment from 'moment-timezone';

import {configureFormatting} from '@sentry/scraps/dateTime';
import {TranslationContextProvider} from '@sentry/scraps/translation';

import {getSnapshot} from '../dateTime/config';

import {getRelativeDate} from './getRelativeDate';
import {useRelativeTimeFormatter} from './useRelativeTimeFormatter';

beforeAll(() => {
  moment.defineLocale('formatting-test', {
    parentLocale: 'en',
    relativeTime: {m: 'une minute'},
  });
});
beforeEach(() => {
  moment.locale('en');
  jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => {
  try {
    jest.runOnlyPendingTimers();
  } finally {
    jest.useRealTimers();
    moment.locale('en');
  }
});

afterAll(() => {
  moment.defineLocale('formatting-test', null);
});

it('preserves fuzzy thresholds and explicit affix overrides', () => {
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
        locale: 'formatting-test',
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
    expect(getRelativeDate('2026-01-01T00:00:02Z', {rounding: 'unit'})).toBe(
      'dans 2 secondes'
    );
    expect(getRelativeDate('2025-12-31T23:59:00Z')).toBe('il y a une minute');
    expect(moment.locale()).toBe('en');
  } finally {
    restore();
  }
});
