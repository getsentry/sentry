import type {ModuleName} from 'sentry/views/insights/types';

const OP_MAPPING = {
  'db.redis': 'cache',
  'db.sql.room': 'other',
};

/**
 * This is a frontend copy of `resolve_span_module` in Discover. `span.category` is a synthetic tag, computed from a combination of the span op and the span category.
 */
export function resolveSpanModule(op?: string, category?: string): ModuleName {
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return OP_MAPPING[op ?? ''] ?? category ?? 'other';
}
