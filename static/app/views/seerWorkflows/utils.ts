import moment from 'moment-timezone';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {WorkflowCronSchedule} from './types';

/**
 * How often automation data refetches on its own while the tab is visible
 */
export const AUTO_REFRESH_INTERVAL = 30_000;

/**
 * Query options a caller can override on the shared automation data hooks
 */
export type AutomationQueryOptions = {
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  retry?: boolean | number;
  staleTime?: number;
};

export function getAutomationsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/`);
}

export function getAutomationRunsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/runs/`);
}

export function getAutomationCreatePath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/new/`);
}

export function getAutomationDetailPath(organizationSlug: string, automationId: string) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/seer/automations/${encodeURIComponent(automationId)}/`
  );
}

export function useAutomationsEnabled() {
  const organization = useOrganization({allowNull: true});
  return !!organization?.features.includes('seer-automations');
}

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * How far ahead to look for a firing. Covers schedules that only fire on a leap day.
 */
const MAX_DAYS_AHEAD = 366 * 5;

/**
 * Reads one value of a crontab field, e.g. `5` or `mon`
 */
function parseValue(value: string, names: string[], namesStartAt: number) {
  const nameIndex = names.indexOf(value.toLowerCase());
  if (nameIndex !== -1) {
    return nameIndex + namesStartAt;
  }
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

/**
 * Expands one crontab field, e.g. `1-5`, `*\/15` or `0,30`, into the values it
 * matches. Returns null when the field can't be read.
 */
function parseField(
  field: string,
  min: number,
  max: number,
  names: string[] = [],
  namesStartAt = 0
): number[] | null {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const [range = '', stepText, ...rest] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (rest.length > 0 || !Number.isInteger(step) || step < 1) {
      return null;
    }

    let start: number;
    let end: number;
    if (range === '*') {
      start = min;
      end = max;
    } else if (range.includes('-')) {
      const [from = '', to = ''] = range.split('-');
      start = parseValue(from, names, namesStartAt);
      end = parseValue(to, names, namesStartAt);
    } else {
      start = parseValue(range, names, namesStartAt);
      // A single value with a step runs to the end of the range, e.g. `5/15`
      end = stepText === undefined ? start : max;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start < min || end > max) {
      return null;
    }
    for (let value = start; value <= end; value += step) {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a - b);
}

/**
 * Reads a five field crontab expression. Returns null when it can't be read.
 */
function parseCrontab(crontab: string) {
  const fields = crontab.trim().split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }
  const [minute = '', hour = '', dayOfMonth = '', month = '', dayOfWeek = ''] = fields;
  const minutes = parseField(minute, 0, 59);
  const hours = parseField(hour, 0, 23);
  const daysOfMonth = parseField(dayOfMonth, 1, 31);
  const months = parseField(month, 1, 12, MONTH_NAMES, 1);
  // Sunday can be written as 0 or 7
  const daysOfWeek = parseField(dayOfWeek, 0, 7, DAY_NAMES)?.map(day => day % 7);
  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) {
    return null;
  }
  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
    // When both day fields are restricted, a day matching either one fires
    matchesEitherDay: !dayOfMonth.startsWith('*') && !dayOfWeek.startsWith('*'),
  };
}

/**
 * The next time after `now` that a schedule fires, with its crontab evaluated in
 * its timezone. Returns undefined when the schedule can't be read or never fires.
 */
export function getNextCronFiring(
  schedule: WorkflowCronSchedule,
  now: Date
): Date | undefined {
  const parsed = parseCrontab(schedule.crontab);
  if (!parsed || !moment.tz.zone(schedule.timezone)) {
    return undefined;
  }

  const today = moment.tz(now, schedule.timezone).startOf('day');
  for (let daysAhead = 0; daysAhead <= MAX_DAYS_AHEAD; daysAhead++) {
    const day = today.clone().add(daysAhead, 'days');
    const matchesDayOfMonth = parsed.daysOfMonth.includes(day.date());
    const matchesDayOfWeek = parsed.daysOfWeek.includes(day.day());
    const matchesDay = parsed.matchesEitherDay
      ? matchesDayOfMonth || matchesDayOfWeek
      : matchesDayOfMonth && matchesDayOfWeek;
    if (!parsed.months.includes(day.month() + 1) || !matchesDay) {
      continue;
    }

    for (const hour of parsed.hours) {
      for (const minute of parsed.minutes) {
        const firing = moment.tz(
          {year: day.year(), month: day.month(), date: day.date(), hour, minute},
          schedule.timezone
        );
        // A time skipped by daylight saving does not exist on this day
        if (firing.hour() !== hour || firing.minute() !== minute) {
          continue;
        }
        if (firing.valueOf() > now.getTime()) {
          return firing.toDate();
        }
      }
    }
  }
  return undefined;
}

/**
 * The closest upcoming firing across several schedules. Each crontab is evaluated
 * in its own timezone, and the result is an absolute time (UTC). Undefined when
 * there are no schedules or none will fire.
 */
export function getNextCronFiringBulk(
  cronSchedules?: WorkflowCronSchedule[]
): Date | undefined {
  const now = new Date();
  const firings = (cronSchedules ?? [])
    .map(schedule => getNextCronFiring(schedule, now))
    .filter(firing => firing !== undefined);
  return firings.length > 0
    ? new Date(Math.min(...firings.map(firing => firing.getTime())))
    : undefined;
}
