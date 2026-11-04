import type * as React from 'react';
import {createContext, useContext, useSyncExternalStore} from 'react';

import {getClockDisplay, getTimezone, subscribe} from './config';

export interface DateTimeContextValue {
  clockDisplay: '12' | '24';
  timezone: string;
}

const DateTimeContext = createContext<DateTimeContextValue | null>(null);

/** Override the application's timezone and clock for a subtree. */
export function DateTimeProvider({
  value,
  children,
}: {
  children: React.ReactNode;
  value: DateTimeContextValue;
}) {
  return <DateTimeContext value={value}>{children}</DateTimeContext>;
}

export function useTimezone(): string {
  const value = useContext(DateTimeContext);
  const timezone = useSyncExternalStore(subscribe, getTimezone, getTimezone);
  return value?.timezone ?? timezone;
}

export function useClockDisplay(): DateTimeContextValue['clockDisplay'] {
  const value = useContext(DateTimeContext);
  const clockDisplay = useSyncExternalStore(subscribe, getClockDisplay, getClockDisplay);
  return value?.clockDisplay ?? clockDisplay;
}
