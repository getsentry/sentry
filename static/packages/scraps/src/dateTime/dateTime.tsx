import type * as React from 'react';

import {useDateTimeFormatter} from './context';
import type {DateTimeInput, DateTimeOptions} from './format';

export type DateTimeProps = Omit<React.HTMLAttributes<HTMLTimeElement>, 'children'> &
  DateTimeOptions & {date: DateTimeInput};

export function DateTime({
  date,
  mode,
  year,
  precision,
  timezone,
  clock,
  showTimezone,
  ...props
}: DateTimeProps) {
  const format = useDateTimeFormatter();
  const options: DateTimeOptions =
    mode === 'date'
      ? {mode, year, timezone, clock, showTimezone}
      : mode === 'time'
        ? {mode, precision, timezone, clock, showTimezone}
        : {mode, year, precision, timezone, clock, showTimezone};

  return <time {...props}>{format(date, options)}</time>;
}
