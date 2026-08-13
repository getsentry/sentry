import {createContext, useContext} from 'react';

/**
 * Scraps has no notion of who is viewing, so it cannot resolve a timezone on
 * its own. UTC is the neutral default: it is unambiguous, and it is what a
 * timestamp means before anyone localizes it.
 *
 * Applications provide the viewer's timezone with <TimezoneProvider>.
 */
const DEFAULT_TIMEZONE = 'UTC';

const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE);

/**
 * Provide the timezone that components should format absolute times in.
 *
 * `timezone` is an IANA name, e.g. "America/New_York". Without a provider,
 * components format in UTC.
 */
export function TimezoneProvider({
  timezone,
  children,
}: {
  children: React.ReactNode;
  timezone: string;
}) {
  return <TimezoneContext value={timezone}>{children}</TimezoneContext>;
}

/**
 * Get the timezone that absolute times should be formatted in.
 */
export function useTimezone(): string {
  return useContext(TimezoneContext);
}
