import {classifyTagKey, FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import type {
  TraceItemDetailsMeta,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';

/**
 * Attribute Relay attaches when a data scrubbing rule with `redaction: {method: "encrypt"}`
 * matched. It holds a base64 encoded sealed box of every value those rules captured on this
 * item, readable only with the organization's private key.
 *
 * See `ENCRYPTED_PII_KEY` in relay-pii.
 */
export const ENCRYPTED_PII_ATTRIBUTE = '_encrypted_pii';

/**
 * Placeholder Relay leaves behind in place of an encrypted value.
 */
export const ENCRYPTED_PLACEHOLDER = '[Encrypted]';

/**
 * The sealed payload attached to this item, if any of its attributes were encrypted.
 */
export function getEncryptedPii(
  attributes: TraceItemResponseAttribute[]
): string | undefined {
  const attribute = attributes.find(({name}) => name === ENCRYPTED_PII_ATTRIBUTE);
  return attribute?.type === 'str' && attribute.value ? attribute.value : undefined;
}

/**
 * Whether an attribute's value was encrypted rather than destroyed.
 *
 * The remark is the authoritative signal, but it only exists when the item carries scrubbing
 * meta. Fall back to the placeholder Relay substitutes into the value so the action still shows
 * up for items served without meta.
 */
export function isEncryptedAttribute({
  attributeKey,
  value,
  traceItemMeta,
}: {
  attributeKey: string;
  value: string | number | null;
  traceItemMeta?: TraceItemDetailsMeta;
}): boolean {
  if (traceItemMeta && new TraceItemMetaInfo(traceItemMeta).isEncrypted(attributeKey)) {
    return true;
  }

  return typeof value === 'string' && value.includes(ENCRYPTED_PLACEHOLDER);
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
