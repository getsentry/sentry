import {ATTRIBUTE_SEARCH_METADATA, type AttributeSearchType} from '@sentry/conventions';

import type {TagCollection} from 'sentry/types/group';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {FieldKind, FieldValueType} from './types';

/**
 * Other names the value is readable under, excluding the search key itself.
 * Template keys like `params.<key>` are dropped — they are not typeable aliases.
 */
export function getAttributeSearchDeprecationAliases(key: string): string[] {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!metadata) {
    return [];
  }

  return metadata.deprecationChain.filter(alias => alias !== key && !alias.includes('<'));
}

/**
 * Preferred search-facing name for a convention key.
 * `deprecationChain[0]` is only used when it is itself a search metadata key;
 * otherwise the current search name is preferred (e.g. `environment` over
 * internal `sentry.environment`).
 */
export function getPreferredAttributeSearchKey(key: string): string | undefined {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!metadata) {
    return undefined;
  }
  const chainPreferred = metadata.deprecationChain[0];
  if (chainPreferred && Object.hasOwn(ATTRIBUTE_SEARCH_METADATA, chainPreferred)) {
    return chainPreferred;
  }
  return key;
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

  for (const alias of getAttributeSearchDeprecationAliases(key)) {
    if (alias in ATTRIBUTE_SEARCH_SECONDARY_ALIASES) {
      continue;
    }
    if (getPreferredAttributeSearchKey(alias) === alias) {
      continue;
    }
    const aliasMetadata = ATTRIBUTE_SEARCH_METADATA[alias];
    ATTRIBUTE_SEARCH_SECONDARY_ALIASES[alias] = {
      key: alias,
      name: alias,
      alias: key,
      kind: attributeSearchTypeToFieldKind((aliasMetadata ?? metadata).type),
    };
  }
}
