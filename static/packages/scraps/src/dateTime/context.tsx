import type * as React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import {getSnapshot, subscribe, type DateTimePreferences} from './config';
import {
  formatDateTimeWithSnapshot,
  type DateTimeInput,
  type DateTimeOptions,
} from './format';

const DateTimeContext = createContext<Partial<DateTimePreferences>>({});

/** Override only the specified preferences, inheriting the rest from the parent. */
export function DateTimeProvider({
  value,
  children,
}: {
  children: React.ReactNode;
  value: Partial<DateTimePreferences>;
}) {
  const parent = useContext(DateTimeContext);
  const preferences = useMemo(
    () => ({
      timezone: value.timezone ?? parent.timezone,
      clock: value.clock ?? parent.clock,
    }),
    [parent, value.timezone, value.clock]
  );
  return <DateTimeContext value={preferences}>{children}</DateTimeContext>;
}

export function useFormattingSnapshot() {
  const overrides = useContext(DateTimeContext);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () => ({
      ...snapshot,
      timezone: overrides.timezone ?? snapshot.timezone,
      clock: overrides.clock ?? snapshot.clock,
    }),
    [snapshot, overrides]
  );
}

export function useTimezone(): string {
  return useFormattingSnapshot().timezone;
}

export function useClock(): DateTimePreferences['clock'] {
  return useFormattingSnapshot().clock;
}

export function useDateTimeFormatter() {
  const snapshot = useFormattingSnapshot();
  return useCallback(
    (date: DateTimeInput, options: DateTimeOptions = {}) =>
      formatDateTimeWithSnapshot(date, options, snapshot),
    [snapshot]
  );
}
