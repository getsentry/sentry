import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

// Pops timestamp out and places it at the end instead when rendering.
export function rearrangedLogsReplayFields(fields: readonly string[]): string[] {
  return fields
    .filter(field => field !== OurLogKnownFieldKey.TIMESTAMP)
    .concat(OurLogKnownFieldKey.TIMESTAMP);
}
