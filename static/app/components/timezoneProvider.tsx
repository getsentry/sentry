import {createContext, useContext, useMemo, useState} from 'react';

import {useUser} from 'sentry/utils/useUser';

interface TimezoneProviderValue {
  timezone: string;
  setOverride?: (timezone: string | null) => void;
}

interface CommonProps {
  children: NonNullable<React.ReactNode>;
}

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const Provider = createContext<TimezoneProviderValue>({timezone: browserTimezone});

interface TimezoneProviderProps {
  children: NonNullable<React.ReactNode>;
  timezone: string;
}

/**
 * Provide the specified timezone to components that useTimezone.
 *
 * See OverrideTimezoneProvider for a implementation of the timezone provider
 * that allows for overriding the timezone using hooks.
 */
export function TimezoneProvider({children, timezone}: TimezoneProviderProps) {
  const value = useMemo(() => ({timezone}), [timezone]);

  return <Provider value={value}>{children}</Provider>;
}

/**
 * Provides the user's configured timezone to components that use useTimezone.
 */
export function UserTimezoneProvider({children}: CommonProps) {
  const user = useUser();
  const timezone = user?.options.timezone ?? browserTimezone;

  return <TimezoneProvider timezone={timezone}>{children}</TimezoneProvider>;
}

/**
 * Allows components that use useTimezone (such as <DateTime />) that are
 * within this provider to be overridden using the useTimezoneOverride hook.
 */
export function OverrideTimezoneProvider({children}: CommonProps) {
  const parentTimezone = useTimezone();
  const [override, setOverride] = useState<string | null>(null);

  const timezone = override ?? parentTimezone;
  const value = useMemo(() => ({timezone, setOverride}), [timezone]);

  return <Provider value={value}>{children}</Provider>;
}

/**
 * Get the currently configured timezone.
 */
export function useTimezone() {
  return useContext(Provider).timezone;
}

/**
 * This hook may be used to override the result of useTimezone in the nearest
 * OverrideTimezoneProvider. The result is a pair of {setOverride,
 * clearOverride} functions.
 *
 * It is the callers responsibility to call clearOverride to restore the
 * timezone in the OverrideTimezoneProvider.
 */
export function useTimezoneOverride() {
  const {setOverride} = useContext(Provider);

  if (setOverride === undefined) {
    throw new Error('useTimezoneOverride requires a OverrideTimezoneProvider');
  }

  const result = useMemo(
    () => ({
      setOverride: (timezone: string) => setOverride(timezone),
      clearOverride: () => setOverride(null),
    }),
    [setOverride]
  );

  return result;
}
