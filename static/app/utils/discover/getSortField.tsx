import type {MetaType} from 'sentry/utils/discover/eventView';
import {AGGREGATIONS, isEquation} from 'sentry/utils/discover/fields';

// Sorting metadata for the fields `fieldRenderers` formats. It lives apart from the
// renderers so that code which only sorts, like EventView, doesn't load them and
// everything they import.

/**
 * The special fields with a custom renderer, and what each one sorts by. `null`
 * means the field can't be sorted.
 */
const SPECIAL_FIELD_SORT_FIELDS = {
  'apdex()': 'apdex()',
  attachments: null,
  minidump: null,
  id: 'id',
  span_id: 'span_id',
  'span.description': 'span.description',
  trace: 'trace',
  'issue.id': 'issue.id',
  replayId: 'replayId',
  'replay.id': 'replay.id',
  'profile.id': 'profile.id',
  issue: null,
  project: 'project',
  project_id: 'project_id',
  'project.id': 'project.id',
  user: 'user',
  'user.display': 'user.display',
  'count_unique(user)': 'count_unique(user)',
  device: 'device',
  adoption_stage: 'adoption_stage',
  release: 'release',
  'error.handled': 'error.handled',
  is_starred_transaction: null,
  team_key_transaction: null,
  'trend_percentage()': 'trend_percentage()',
  timestamp: 'timestamp',
  'timestamp.to_hour': 'timestamp.to_hour',
  'timestamp.to_day': 'timestamp.to_day',
  'span.status_code': 'span.status_code',
  'performance_score(measurements.score.total)':
    'performance_score(measurements.score.total)',
  'opportunity_score(measurements.score.total)':
    'opportunity_score(measurements.score.total)',
  'browser.name': 'browser.name',
  browser: 'browser',
  'os.name': 'os.name',
  os: 'os',
  'gen_ai.request.model': 'gen_ai.request.model',
  'gen_ai.response.model': 'gen_ai.response.model',
  'gen_ai.output.messages': 'gen_ai.output.messages',
} as const satisfies Record<string, string | null>;

export type SpecialFieldKey = keyof typeof SPECIAL_FIELD_SORT_FIELDS;

/**
 * The field value types with a formatter, and whether columns of that type sort.
 */
const FIELD_FORMATTER_SORTABILITY = {
  array: true,
  boolean: true,
  currency: true,
  date: true,
  duration: true,
  integer: true,
  number: true,
  percent_change: true,
  percentage: true,
  rate: true,
  size: true,
  string: true,
} as const satisfies Record<string, boolean>;

export type FieldFormatterType = keyof typeof FIELD_FORMATTER_SORTABILITY;

/**
 * Get the sort field name for a given field if it is special or fallback
 * to the generic type formatter.
 */
export function getSortField(
  field: string,
  tableMeta: MetaType | undefined
): string | null {
  if (Object.hasOwn(SPECIAL_FIELD_SORT_FIELDS, field)) {
    return SPECIAL_FIELD_SORT_FIELDS[field as SpecialFieldKey];
  }

  if (!tableMeta) {
    return field;
  }

  if (isEquation(field)) {
    return field;
  }

  for (const alias in AGGREGATIONS) {
    if (field.startsWith(alias)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return AGGREGATIONS[alias].isSortable ? field : null;
    }
  }

  const fieldType = tableMeta[field];
  if (Object.hasOwn(FIELD_FORMATTER_SORTABILITY, fieldType)) {
    return FIELD_FORMATTER_SORTABILITY[fieldType as FieldFormatterType] ? field : null;
  }

  return null;
}
