import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';

/**
 * Infers the category of a span based on its available attributes
 */
export function getSpanCategory(span: RawSpanType) {
  const {attributes, sentry_tags} = span;

  if (attributes) {
    return 'unknown';
  }

  if (sentry_tags) {
    return sentry_tags.category ?? 'unknown';
  }

  return 'unknown';
}
