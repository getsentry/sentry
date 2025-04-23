import {prettifyTagKey} from 'sentry/utils/discover/fields';

function removePrefixes(key: string) {
  key.replace(/^log\.|^sentry\./, '');
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
