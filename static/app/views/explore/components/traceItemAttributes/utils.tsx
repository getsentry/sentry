import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions/attributes/search';

import {
  classifyTagKey,
  FieldKind,
  isTypedTagKey,
  prettifyTagKey,
} from 'sentry/utils/fields';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

const BACKEND_ONLY_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  message: 'sentry.body',
  severity: 'sentry.severity_text',
  severity_number: 'sentry.severity_number',
  trace: 'sentry.trace_id',
  span_id: 'sentry.span_id',
  timestamp_precise: 'sentry.timestamp_precise',
  observed_timestamp: 'sentry.observed_timestamp_nanos',
  payload_size: 'sentry.payload_size_bytes',
  'message.template': 'sentry.message.template',
  'precise.start_ts': 'sentry.start_timestamp_precise',
  'precise.finish_ts': 'sentry.end_timestamp_precise',
};

export function getTraceItemAttributeName(
  searchAlias: string,
  useRawAttributeNames: boolean
): string {
  if (!useRawAttributeNames) {
    return searchAlias;
  }

  if (Object.hasOwn(ATTRIBUTE_SEARCH_METADATA, searchAlias)) {
    return ATTRIBUTE_SEARCH_METADATA[searchAlias]!.canonicalName;
  }

  return Object.hasOwn(BACKEND_ONLY_ATTRIBUTE_NAMES, searchAlias)
    ? BACKEND_ONLY_ATTRIBUTE_NAMES[searchAlias]!
    : searchAlias;
}

export function getTraceItemAttribute(
  attributes: readonly TraceItemResponseAttribute[] | undefined,
  searchAlias: string,
  useRawAttributeNames: boolean
): TraceItemResponseAttribute | undefined {
  const name = getTraceItemAttributeName(searchAlias, useRawAttributeNames);
  return attributes?.find(attribute =>
    useRawAttributeNames && attribute.queryName !== undefined
      ? attribute.queryName === searchAlias
      : attribute.name === name
  );
}

export function withRawAttributeRenderers<T>(
  renderers: Record<string, T>,
  useRawAttributeNames: boolean
): Record<string, T> {
  if (!useRawAttributeNames) {
    return renderers;
  }

  const result: Record<string, T> = {};
  for (const [alias, renderer] of Object.entries(renderers)) {
    const rawName = isTypedTagKey(alias)
      ? prettifyTagKey(alias)
      : getTraceItemAttributeName(alias, useRawAttributeNames);
    if (renderer !== undefined) {
      result[rawName] = Object.hasOwn(renderers, rawName)
        ? renderers[rawName]!
        : renderer;
    }
  }
  return result;
}

function removePrefixes(key: string) {
  return key.replace(/^log\.|^sentry\./, '');
}

export function prettifyAttributeName(name: string) {
  return removePrefixes(prettifyTagKey(name));
}

export function getAttributeItem(field: string, value: string | number | null) {
  return {
    fieldKey: field,
    value,
  };
}

/**
 * Numeric filter actions (greater/less than) should appear when we have an
 * explicit numeric type from the trace-item response, a typed tag key
 * (`tags[name,number]`), or a JS number value as a fallback.
 */
export function isNumericAttribute({
  value,
  type,
  key,
}: {
  value: string | number | null;
  key?: string;
  type?: TraceItemResponseAttribute['type'];
}): boolean {
  if (value === null) {
    return false;
  }

  if (type === 'int' || type === 'float') {
    return true;
  }

  if (key && classifyTagKey(key) === FieldKind.MEASUREMENT) {
    return true;
  }

  return typeof value === 'number';
}
