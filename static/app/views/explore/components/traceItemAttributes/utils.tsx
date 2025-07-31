import {prettifyTagKey} from 'sentry/utils/fields';

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
