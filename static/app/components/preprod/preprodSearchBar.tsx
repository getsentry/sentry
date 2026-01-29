import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {HIDDEN_PREPROD_ATTRIBUTES} from 'sentry/views/explore/constants';
import {useTraceItemAttributesWithConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
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
  onChange?: (query: string, state: {queryIsValid: boolean}) => void;
  onSearch?: (query: string) => void;
  portalTarget?: HTMLElement | null;
  searchSource?: string;
}

function filterToAllowedKeys(
  attributes: TagCollection,
  allowedKeys: string[]
): TagCollection {
  const allowedSet = new Set(allowedKeys);
  const result: TagCollection = {};
  for (const key in attributes) {
    if (allowedSet.has(key) && attributes[key]) {
      result[key] = attributes[key];
    }
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
  onChange,
  onSearch,
  portalTarget,
  disallowFreeText,
  disallowHas,
  disallowLogicalOperators,
  searchSource = 'preprod',
}: PreprodSearchBarProps) {
  const organization = useOrganization();

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.PREPROD,
    enabled: organization.features.includes('preprod-app-size-dashboard'),
  };

  // When using allowedKeys, we fetch all attributes then filter to the allowlist.
  // Otherwise, we use HIDDEN_PREPROD_ATTRIBUTES to hide internal fields.
  const hiddenKeys = allowedKeys ? undefined : HIDDEN_PREPROD_ATTRIBUTES;

  const {attributes: rawStringAttributes, secondaryAliases: rawStringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string', hiddenKeys);
  const {attributes: rawNumberAttributes, secondaryAliases: rawNumberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number', hiddenKeys);

  const stringAttributes = useMemo(
    () =>
      allowedKeys
        ? filterToAllowedKeys(rawStringAttributes, allowedKeys)
        : rawStringAttributes,
    [allowedKeys, rawStringAttributes]
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

  return (
    <TraceItemSearchQueryBuilder
      initialQuery={initialQuery}
      onSearch={onSearch}
      onChange={onChange}
      itemType={TraceItemDataset.PREPROD}
      numberAttributes={numberAttributes}
      stringAttributes={stringAttributes}
      numberSecondaryAliases={numberSecondaryAliases}
      stringSecondaryAliases={stringSecondaryAliases}
      searchSource={searchSource}
      projects={projects}
      portalTarget={portalTarget}
      disallowFreeText={disallowFreeText}
      disallowHas={disallowHas}
      disallowLogicalOperators={disallowLogicalOperators}
    />
  );
}
