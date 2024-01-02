import {ModuleName} from 'sentry/views/starfish/types';

const OP_MAPPING = {
  'db.redis': 'cache',
  'db.sql.room': 'other',
};

/**
 * This is a frontend copy of `resolve_span_module` in Discover. `span.category` is a synthetic tag, computed from a combination of the span op and the span category.
 */
export function resolveSpanModule(op?: string, category?: string): ModuleName {
  return OP_MAPPING[op ?? ''] ?? category ?? 'other';
}
