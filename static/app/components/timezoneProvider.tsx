import {createContext, useContext, useMemo} from 'react';

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
 * Get the currently configured timezone.
 */
export function useTimezone() {
  return useContext(Provider).timezone;
}
