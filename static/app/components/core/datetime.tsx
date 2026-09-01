import {createContext, useContext} from 'react';

/**
 * How an absolute time should be written out for the person reading it.
 *
 * Scraps has no notion of who is viewing, so it cannot resolve either of these
 * on its own. The defaults are the neutral reading of a timestamp before anyone
 * localizes it: UTC, on a 12 hour clock, which is what the unprefixed formats
 * in `getFormat` already produce.
 *
 * Applications provide the viewer's values with <DateTimeProvider>.
 */
export interface DateTimeContextValue {
  /**
   * Whether times are written on a 12 or 24 hour clock.
   */
  clockDisplay: '12' | '24';
  /**
   * IANA timezone name, e.g. "America/New_York".
   */
  timezone: string;
}

const DEFAULT_DATE_TIME: DateTimeContextValue = {
  timezone: 'UTC',
  clockDisplay: '12',
};

const DateTimeContext = createContext<DateTimeContextValue>(DEFAULT_DATE_TIME);

/**
 * Provide the timezone and clock that absolute times should be written in.
 *
 * Takes the whole value rather than separate props so that consumers wire up
 * one thing; memoize it if you are building it inline.
 */
export function DateTimeProvider({
  value,
  children,
}: {
  children: React.ReactNode;
  value: DateTimeContextValue;
}) {
  return <DateTimeContext value={value}>{children}</DateTimeContext>;
}

/**
 * The timezone absolute times should be written in.
 */
export function useTimezone(): string {
  return useContext(DateTimeContext).timezone;
}

/**
 * Whether absolute times should be written on a 12 or 24 hour clock.
 */
export function useClockDisplay(): DateTimeContextValue['clockDisplay'] {
  return useContext(DateTimeContext).clockDisplay;
}
