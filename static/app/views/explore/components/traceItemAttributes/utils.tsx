import {classifyTagKey, FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

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
