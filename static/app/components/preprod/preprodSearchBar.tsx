import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {HIDDEN_PREPROD_ATTRIBUTES} from 'sentry/views/explore/constants';
import {usePreprodItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
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

const PREPROD_FILTER_KEY_KINDS: Record<string, FieldKind> = {
  app_id: FieldKind.TAG,
  app_name: FieldKind.TAG,
  build_configuration_name: FieldKind.TAG,
  build_number: FieldKind.TAG,
  build_version: FieldKind.TAG,
  distribution_error_code: FieldKind.TAG,
  download_count: FieldKind.MEASUREMENT,
  download_size: FieldKind.MEASUREMENT,
  git_base_ref: FieldKind.TAG,
  git_base_sha: FieldKind.TAG,
  git_head_ref: FieldKind.TAG,
  git_head_repo_name: FieldKind.TAG,
  git_head_sha: FieldKind.TAG,
  git_pr_number: FieldKind.MEASUREMENT,
  image_count: FieldKind.MEASUREMENT,
  images_added: FieldKind.MEASUREMENT,
  images_changed: FieldKind.MEASUREMENT,
  images_removed: FieldKind.MEASUREMENT,
  images_renamed: FieldKind.MEASUREMENT,
  images_skipped: FieldKind.MEASUREMENT,
  images_unchanged: FieldKind.MEASUREMENT,
  install_size: FieldKind.MEASUREMENT,
  installable: FieldKind.BOOLEAN,
  is_approved: FieldKind.BOOLEAN,
  platform_name: FieldKind.TAG,
  size_state: FieldKind.TAG,
};

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

function getAllowedFilterKeys(allowedKeys: string[]): TagCollection {
  return Object.fromEntries(
    allowedKeys.map(key => {
      const kind = PREPROD_FILTER_KEY_KINDS[key];
      return [
        key,
        {
          key,
          name: key,
          ...(kind ? {kind} : {}),
        },
      ];
    })
  );
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
  // When using allowedKeys, we fetch all attributes then filter to the allowlist.
  // Otherwise, we use HIDDEN_PREPROD_ATTRIBUTES to hide internal fields.
  const hiddenKeys = allowedKeys ? undefined : HIDDEN_PREPROD_ATTRIBUTES;
  const allowedFilterKeys = useMemo(
    () => (allowedKeys ? getAllowedFilterKeys(allowedKeys) : undefined),
    [allowedKeys]
  );

  const {attributes: rawStringAttributes, secondaryAliases: rawStringSecondaryAliases} =
    usePreprodItemAttributes({}, 'string', hiddenKeys);
  const {attributes: rawNumberAttributes, secondaryAliases: rawNumberSecondaryAliases} =
    usePreprodItemAttributes({}, 'number', hiddenKeys);
  const {attributes: rawBooleanAttributes, secondaryAliases: rawBooleanSecondaryAliases} =
    usePreprodItemAttributes({}, 'boolean', hiddenKeys);

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
      booleanAttributes={booleanAttributes}
      booleanSecondaryAliases={booleanSecondaryAliases}
      searchSource={searchSource}
      projects={projects}
      portalTarget={portalTarget}
      disallowFreeText={disallowFreeText}
      disallowHas={disallowHas}
      disallowLogicalOperators={disallowLogicalOperators}
      hiddenAttributeKeys={hiddenKeys}
      allowedFilterKeys={allowedFilterKeys}
    />
  );
}
