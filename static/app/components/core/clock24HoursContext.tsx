import {createContext, useContext} from 'react';

/**
 * Scraps has no notion of who is viewing, so it cannot resolve a clock
 * preference on its own. A 12 hour clock is the neutral default because it is
 * what the unprefixed formats in `getFormat` already produce.
 *
 * Applications provide the viewer's preference with <Clock24HoursProvider>.
 */
const DEFAULT_CLOCK_24_HOURS = false;

const Clock24HoursContext = createContext<boolean>(DEFAULT_CLOCK_24_HOURS);

/**
 * Provide whether absolute times should be formatted on a 24 hour clock.
 *
 * Kept separate from the timezone rather than bundled into one "time
 * preferences" object so that changing one does not re-render consumers of the
 * other, and so each stays a primitive that needs no memoization.
 */
export function Clock24HoursProvider({
  clock24Hours,
  children,
}: {
  children: React.ReactNode;
  clock24Hours: boolean;
}) {
  return <Clock24HoursContext value={clock24Hours}>{children}</Clock24HoursContext>;
}

/**
 * Whether absolute times should be formatted on a 24 hour clock.
 */
export function useClock24Hours(): boolean {
  return useContext(Clock24HoursContext);
}
