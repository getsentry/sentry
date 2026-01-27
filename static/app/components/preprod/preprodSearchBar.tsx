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
   * When true, free text will be marked as invalid.
   */
  disallowFreeText?: boolean;
  disallowHas?: boolean;
  /**
   * When true, parens and logical operators (AND, OR) will be marked as invalid.
   */
  disallowLogicalOperators?: boolean;
  /**
   * List of attribute keys to hide from the search bar. Defaults to HIDDEN_PREPROD_ATTRIBUTES.
   */
  hiddenKeys?: string[];
  onChange?: (query: string, state: {queryIsValid: boolean}) => void;
  onSearch?: (query: string) => void;
  portalTarget?: HTMLElement | null;
  searchSource?: string;
}

/**
 * A reusable search bar component for preprod/mobile build data.
 * Automatically fetches available attributes from the EAP /attribute endpoint.
 */
export function PreprodSearchBar({
  initialQuery,
  projects,
  hiddenKeys = HIDDEN_PREPROD_ATTRIBUTES,
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

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string', hiddenKeys);
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number', hiddenKeys);

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
