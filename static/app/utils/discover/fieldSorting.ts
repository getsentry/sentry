import type {MetaType} from 'sentry/utils/discover/eventView';
import {AGGREGATIONS, isEquation} from 'sentry/utils/discover/fields';
import {SpanFields} from 'sentry/views/insights/types';

export const SPECIAL_FIELD_SORT_FIELDS: Record<string, string | null> = {
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
  [SpanFields.IS_STARRED_TRANSACTION]: null,
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
  [SpanFields.GEN_AI_REQUEST_MODEL]: SpanFields.GEN_AI_REQUEST_MODEL,
  [SpanFields.GEN_AI_RESPONSE_MODEL]: SpanFields.GEN_AI_RESPONSE_MODEL,
  [SpanFields.GEN_AI_OUTPUT_MESSAGES]: SpanFields.GEN_AI_OUTPUT_MESSAGES,
};

export const FIELD_FORMATTER_SORTABILITY = {
  boolean: true,
  date: true,
  duration: true,
  rate: true,
  integer: true,
  number: true,
  percentage: true,
  size: true,
  string: true,
  array: true,
  percent_change: true,
  currency: true,
};

/**
 * Get the sort field name for a given field if it is special or fallback
 * to the generic type formatter.
 */
export function getSortField(
  field: string,
  tableMeta: MetaType | undefined
): string | null {
  if (Object.hasOwn(SPECIAL_FIELD_SORT_FIELDS, field)) {
    return SPECIAL_FIELD_SORT_FIELDS[field]!;
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
    return FIELD_FORMATTER_SORTABILITY[
      fieldType as keyof typeof FIELD_FORMATTER_SORTABILITY
    ]
      ? field
      : null;
  }

  return null;
}
