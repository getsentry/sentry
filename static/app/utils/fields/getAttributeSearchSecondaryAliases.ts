import {ATTRIBUTE_SEARCH_METADATA, type AttributeSearchType} from '@sentry/conventions';

import type {TagCollection} from 'sentry/types/group';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {FieldKind, FieldValueType} from './types';

/**
 * Template keys like `params.<key>` are not typeable search names.
 */
function isTemplateAttributeSearchKey(key: string): boolean {
  return key.includes('<');
}

/**
 * Other names the value is readable under, excluding the search key itself.
 * Template keys like `params.<key>` are dropped — they are not typeable aliases.
 */
export function getAttributeSearchDeprecationAliases(key: string): string[] {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!metadata) {
    return [];
  }

  return metadata.deprecationChain.filter(
    alias => alias !== key && !isTemplateAttributeSearchKey(alias)
  );
}

/**
 * Preferred search-facing name for a convention key.
 * Uses the first deprecation chain member that is itself a search metadata key
 * (e.g. `transaction` when canonical `sentry.segment.name` is not searchable).
 */
export function getPreferredAttributeSearchKey(key: string): string | undefined {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!metadata) {
    return undefined;
  }
  return metadata.deprecationChain.find(candidate =>
    Object.hasOwn(ATTRIBUTE_SEARCH_METADATA, candidate)
  );
}

function attributeSearchTypeToFieldKind(type: AttributeSearchType): FieldKind {
  const valueType = attributeSearchTypeToFieldValueType(type);
  if (valueType === FieldValueType.ARRAY) {
    return FieldKind.ARRAY;
  }
  if (valueType === FieldValueType.BOOLEAN) {
    return FieldKind.BOOLEAN;
  }
  if (valueType === FieldValueType.STRING) {
    return FieldKind.TAG;
  }
  return FieldKind.MEASUREMENT;
}

/**
 * Deprecated / alternate names from convention deprecation chains, as SQB
 * `filterKeyAliases`. `alias` is the preferred search key to migrate to.
 */
export const ATTRIBUTE_SEARCH_SECONDARY_ALIASES: TagCollection = {};

for (const [key, metadata] of Object.entries(ATTRIBUTE_SEARCH_METADATA)) {
  if (getPreferredAttributeSearchKey(key) !== key) {
    continue;
  }
  if (isTemplateAttributeSearchKey(key)) {
    continue;
  }

  for (const alias of getAttributeSearchDeprecationAliases(key)) {
    if (alias in ATTRIBUTE_SEARCH_SECONDARY_ALIASES) {
      continue;
    }
    const preferred = getPreferredAttributeSearchKey(alias) ?? key;
    if (preferred === alias || isTemplateAttributeSearchKey(preferred)) {
      continue;
    }
    const aliasMetadata = ATTRIBUTE_SEARCH_METADATA[alias];
    ATTRIBUTE_SEARCH_SECONDARY_ALIASES[alias] = {
      key: alias,
      name: alias,
      alias: preferred,
      kind: attributeSearchTypeToFieldKind((aliasMetadata ?? metadata).type),
    };
  }
}
