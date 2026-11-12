const HAS_TIMEZONE = /([zZ]|[+-]\d{2}:\d{2})$/;

/**
 * Parse `timestamp_ms` from the events endpoint.
 *
 * Historically snuba returned DateTime64 values as
 * "YYYY-MM-DD HH:MM:SS.sss" (no `T`, no timezone). After snuba started
 * ISO-formatting DateTime64 columns, values may also arrive as full ISO-8601
 * strings with a `Z` or numeric offset (e.g. "...+00:00").
 *
 * Always interpret timezone-less values as UTC.
 */
export function parseEventTimestampMs(timestampMs: string): Date {
  if (HAS_TIMEZONE.test(timestampMs)) {
    return new Date(timestampMs);
  }

  return new Date(`${timestampMs.replace(' ', 'T')}Z`);
}

/**
 * "YYYY-MM-DD HH:MM:SS.sss" — legacy non-ISO shape used by specs, stories,
 * and replay fixtures.
 * @public
 */
export function toEventTimestampMs(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '');
}
