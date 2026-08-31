import {useMemo} from 'react';

import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {HIDDEN_PREPROD_ATTRIBUTES} from 'sentry/views/explore/constants';
import {usePreprodItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface PreprodSearchBarProps {
  initialQuery: string;
  /**
   * Project IDs to scope the search to. In settings pages, get this from
   * projectOutlet. In dashboard pages, get this from page filters.
   */
  projects: number[];
  /**
   * List of attribute keys to show in the search bar. When provided, only these
   * keys will be available. When omitted, all keys except HIDDEN_PREPROD_ATTRIBUTES
   * are shown.
   */
  allowedKeys?: string[];
  /**
   * When true, free text will be marked as invalid.
   */
  disallowFreeText?: boolean;
  disallowHas?: boolean;
  /**
   * When true, parens and logical operators (AND, OR) will be marked as invalid.
   */
  disallowLogicalOperators?: boolean;
  /**
   * List of attribute keys whose values should be entered as free text instead
   * of fetched from the trace item attribute values endpoint.
   */
  freeformKeys?: string[];
  onChange?: (query: string, state: {queryIsValid: boolean}) => void;
  onSearch?: (query: string) => void;
  portalTarget?: HTMLElement | null;
  searchSource?: string;
}

// Array attributes are keyed by their wrapped backend form (`tags[name,array]`),
// so also match the unwrapped `name` that the allowlist / freeform lists use.
function matchesKeyOrArrayName(tag: Tag, key: string, names: Set<string>): boolean {
  return names.has(key) || (tag.kind === FieldKind.ARRAY && names.has(tag.name));
}

function filterToAllowedKeys(
  attributes: TagCollection,
  allowedKeys: string[]
): TagCollection {
  const allowedSet = new Set(allowedKeys);
  const result: TagCollection = {};
  for (const key in attributes) {
    const tag = attributes[key];
    if (tag && matchesKeyOrArrayName(tag, key, allowedSet)) {
      result[key] = tag;
    }
  }
  return result;
}

function markFreeformKeys(
  attributes: TagCollection,
  freeformKeys?: string[]
): TagCollection {
  const freeformKeySet = new Set(freeformKeys);
  const result: TagCollection = {};
  for (const key in attributes) {
    const tag = attributes[key];
    if (!tag) {
      continue;
    }
    result[key] = matchesKeyOrArrayName(tag, key, freeformKeySet)
      ? {...tag, predefined: true}
      : tag;
  }
  return result;
}

/**
 * A reusable search bar component for preprod/mobile build data.
 * Automatically fetches available attributes from the EAP /attribute endpoint.
 *
 * By default, shows all attributes except HIDDEN_PREPROD_ATTRIBUTES.
 * Use `allowedKeys` to restrict to only specific attributes (for settings pages).
 */
export function PreprodSearchBar({
  initialQuery,
  projects,
  allowedKeys,
  freeformKeys,
  onChange,
  onSearch,
  portalTarget,
  disallowFreeText,
  disallowHas,
  disallowLogicalOperators,
  searchSource = 'preprod',
}: PreprodSearchBarProps) {
  const organization = useOrganization();
  const supportsArrays = organization.features.includes('trace-item-array-query-support');
  // When using allowedKeys, we fetch all attributes then filter to the allowlist.
  // Otherwise, we use HIDDEN_PREPROD_ATTRIBUTES to hide internal fields.
  const hiddenKeys = allowedKeys ? undefined : HIDDEN_PREPROD_ATTRIBUTES;

  const {attributes: rawStringAttributes, secondaryAliases: rawStringSecondaryAliases} =
    usePreprodItemAttributes({}, 'string', hiddenKeys);
  const {attributes: rawNumberAttributes, secondaryAliases: rawNumberSecondaryAliases} =
    usePreprodItemAttributes({}, 'number', hiddenKeys);
  const {attributes: rawBooleanAttributes, secondaryAliases: rawBooleanSecondaryAliases} =
    usePreprodItemAttributes({}, 'boolean', hiddenKeys);
  const {attributes: rawArrayAttributes, secondaryAliases: rawArraySecondaryAliases} =
    usePreprodItemAttributes({enabled: supportsArrays}, 'array', hiddenKeys);

  const stringAttributes = useMemo(
    () =>
      markFreeformKeys(
        allowedKeys
          ? filterToAllowedKeys(rawStringAttributes, allowedKeys)
          : rawStringAttributes,
        freeformKeys
      ),
    [allowedKeys, freeformKeys, rawStringAttributes]
  );

  const stringSecondaryAliases = useMemo(
    () =>
      allowedKeys
        ? filterToAllowedKeys(rawStringSecondaryAliases, allowedKeys)
        : rawStringSecondaryAliases,
    [allowedKeys, rawStringSecondaryAliases]
  );

  const numberAttributes = useMemo(
    () =>
      allowedKeys
        ? filterToAllowedKeys(rawNumberAttributes, allowedKeys)
        : rawNumberAttributes,
    [allowedKeys, rawNumberAttributes]
  );

  const numberSecondaryAliases = useMemo(
    () =>
      allowedKeys
        ? filterToAllowedKeys(rawNumberSecondaryAliases, allowedKeys)
        : rawNumberSecondaryAliases,
    [allowedKeys, rawNumberSecondaryAliases]
  );

  const booleanAttributes = useMemo(
    () =>
      allowedKeys
        ? filterToAllowedKeys(rawBooleanAttributes, allowedKeys)
        : rawBooleanAttributes,
    [allowedKeys, rawBooleanAttributes]
  );

  const booleanSecondaryAliases = useMemo(
    () =>
      allowedKeys
        ? filterToAllowedKeys(rawBooleanSecondaryAliases, allowedKeys)
        : rawBooleanSecondaryAliases,
    [allowedKeys, rawBooleanSecondaryAliases]
  );

  const arrayAttributes = useMemo(() => {
    if (!supportsArrays) {
      return {};
    }
    return markFreeformKeys(
      allowedKeys
        ? filterToAllowedKeys(rawArrayAttributes, allowedKeys)
        : rawArrayAttributes,
      freeformKeys
    );
  }, [allowedKeys, freeformKeys, rawArrayAttributes, supportsArrays]);

  const arraySecondaryAliases = useMemo(() => {
    if (!supportsArrays) {
      return {};
    }
    return allowedKeys
      ? filterToAllowedKeys(rawArraySecondaryAliases, allowedKeys)
      : rawArraySecondaryAliases;
  }, [allowedKeys, rawArraySecondaryAliases, supportsArrays]);

  return (
    <TraceItemSearchQueryBuilder
      initialQuery={initialQuery}
      onSearch={onSearch}
      onChange={onChange}
      itemType={TraceItemDataset.PREPROD}
      numberAttributes={numberAttributes}
      stringAttributes={stringAttributes}
      arrayAttributes={arrayAttributes}
      numberSecondaryAliases={numberSecondaryAliases}
      stringSecondaryAliases={stringSecondaryAliases}
      arraySecondaryAliases={arraySecondaryAliases}
      booleanAttributes={booleanAttributes}
      booleanSecondaryAliases={booleanSecondaryAliases}
      searchSource={searchSource}
      projects={projects}
      portalTarget={portalTarget}
      disallowFreeText={disallowFreeText}
      disallowHas={disallowHas}
      disallowLogicalOperators={disallowLogicalOperators}
      hiddenAttributeKeys={hiddenKeys}
      allowedAttributeKeys={allowedKeys}
    />
  );
}
