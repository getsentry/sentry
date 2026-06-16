// The events endpoint returns `timestamp_ms` as "YYYY-MM-DD HH:MM:SS.sss" with
// no `T` and no timezone.
export function parseEventTimestampMs(timestampMs: string): Date {
  return new Date(`${timestampMs.replace(' ', 'T')}Z`);
}

/**
 * "YYYY-MM-DD HH:MM:SS.sss" — matches the non-ISO shape the events endpoint
 * returns for `timestamp_ms`. Used by specs, stories, and replay fixtures.
 * @public
 */
export function toEventTimestampMs(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '');
}
