import type * as React from 'react';

import {DateTimeProvider as Provider, useClock, useTimezone} from './dateTime';

/**
 * Published 0.4.0 and 0.5.0 exported this API from `@sentry/scraps/datetime`.
 * It now lives in `@sentry/scraps/dateTime`; these aliases keep existing imports
 * working for one release.
 */

/** @deprecated Use `DateTimePreferences` from `@sentry/scraps/dateTime`. */
export interface DateTimeContextValue {
  clockDisplay: '12' | '24';
  timezone: string;
}

/** @deprecated Use `DateTimeProvider` from `@sentry/scraps/dateTime`. */
export function DateTimeProvider({
  value,
  children,
}: {
  children: React.ReactNode;
  value: DateTimeContextValue;
}) {
  return (
    <Provider value={{timezone: value.timezone, clock: value.clockDisplay}}>
      {children}
    </Provider>
  );
}

/** @deprecated Use `useTimezone` from `@sentry/scraps/dateTime`. */
export {useTimezone};

/** @deprecated Use `useClock` from `@sentry/scraps/dateTime`. */
export const useClockDisplay = useClock;
