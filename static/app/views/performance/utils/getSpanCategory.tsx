import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';

/**
 * Determines the category of a span based on its available attributes.
 * With the new OTLP span structure, the category is found in the attributes field.
 * In order to allow for backwards compatibility, `sentry_tags` is checked as a backup.
 */
export function getSpanCategory(span: RawSpanType) {
  const {attributes, sentry_tags} = span;

  if (attributes?.category) {
    return attributes.category;
  }

  if (sentry_tags) {
    return sentry_tags.category ?? 'unknown';
  }

  return 'unknown';
}
