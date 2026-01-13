import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributesWithConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface PreprodSearchBarProps {
  initialQuery: string;
  /**
   * Optional list of attribute keys to show. If not provided, all attributes are shown.
   */
  allowedKeys?: string[];
  onChange?: (query: string, state: {queryIsValid: boolean}) => void;
  onSearch?: (query: string) => void;
  portalTarget?: HTMLElement | null;
  searchSource?: string;
}

function filterAttributes(
  attributes: TagCollection,
  allowedKeys?: string[]
): TagCollection {
  if (!allowedKeys) {
    return attributes;
  }
  const allowedSet = new Set(allowedKeys);
  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => allowedSet.has(key))
  );
}

/**
 * A reusable search bar component for preprod/mobile build data.
 * Automatically fetches available attributes from the EAP /attribute endpoint.
 */
export function PreprodSearchBar({
  initialQuery,
  allowedKeys,
  onChange,
  onSearch,
  portalTarget,
  searchSource = 'preprod',
}: PreprodSearchBarProps) {
  const organization = useOrganization();
  const {
    selection: {projects},
  } = usePageFilters();

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.PREPROD,
    enabled: organization.features.includes('preprod-app-size-dashboard'),
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

  const filteredStringAttributes = useMemo(
    () => filterAttributes(stringAttributes, allowedKeys),
    [stringAttributes, allowedKeys]
  );
  const filteredNumberAttributes = useMemo(
    () => filterAttributes(numberAttributes, allowedKeys),
    [numberAttributes, allowedKeys]
  );

  return (
    <TraceItemSearchQueryBuilder
      initialQuery={initialQuery}
      onSearch={onSearch}
      onChange={onChange}
      itemType={TraceItemDataset.PREPROD}
      numberAttributes={filteredNumberAttributes}
      stringAttributes={filteredStringAttributes}
      numberSecondaryAliases={stringSecondaryAliases}
      stringSecondaryAliases={numberSecondaryAliases}
      searchSource={searchSource}
      projects={projects}
      portalTarget={portalTarget}
    />
  );
}
