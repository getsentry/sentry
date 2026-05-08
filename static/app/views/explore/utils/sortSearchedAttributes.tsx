import type {
  SearchMatchResult,
  SelectKey,
  SelectOption,
  SelectOptionWithKey,
} from '@sentry/scraps/compactSelect';

import {getFieldDefinition, type GetFieldDefinitionType} from 'sentry/utils/fields';
import {fzf} from 'sentry/utils/search/fzf';
import {TraceItemDataset} from 'sentry/views/explore/types';

type SortFieldDefinitionType = GetFieldDefinitionType | TraceItemDataset;

interface SortSearchedAttributesProps<Value extends SelectKey> {
  fieldDefinitionType: SortFieldDefinitionType;
  option: SelectOptionWithKey<Value>;
  searchText: string;
}

export function sortSearchedAttributes<Value extends SelectKey>({
  fieldDefinitionType,
  option,
  searchText,
}: SortSearchedAttributesProps<Value>): SearchMatchResult {
  const text = option.textValue ?? (typeof option.label === 'string' ? option.label : '');
  const normalizedText = text.toLowerCase();
  const normalizedSearch = searchText.toLowerCase();
  // Keep Group By's existing substring filtering behavior while using fzf
  // only to rank the matched options.
  if (!normalizedText.includes(normalizedSearch)) {
    return {score: 0};
  }

  const result = fzf(text, normalizedSearch, false);
  if (result.end === -1) {
    return {score: 0};
  }

  const isKnown =
    getFieldDefinition(
      String(option.value),
      getFieldDefinitionType(fieldDefinitionType)
    ) !== null;

  const prefixBoost =
    result.start === 0 && result.end === normalizedSearch.length ? 8 : 0;
  return {score: Math.max(1, result.score) + prefixBoost + (isKnown ? 2 : 1)};
}

function getFieldDefinitionType(
  fieldDefinitionType: SortFieldDefinitionType
): GetFieldDefinitionType {
  switch (fieldDefinitionType) {
    case TraceItemDataset.ERRORS:
    case TraceItemDataset.PROCESSING_ERRORS:
      return 'event';
    case TraceItemDataset.LOGS:
      return 'log';
    case TraceItemDataset.PREPROD:
      return 'preprod';
    case TraceItemDataset.REPLAYS:
      return 'replay';
    case TraceItemDataset.SPANS:
      return 'span';
    case TraceItemDataset.TRACEMETRICS:
      return 'tracemetric';
    case TraceItemDataset.UPTIME_RESULTS:
      return 'uptime';
    default:
      return fieldDefinitionType;
  }
}

export function sortKnownAttributes<Value extends SelectOption<string>>(
  a: Value,
  b: Value,
  traceItemType: TraceItemDataset
) {
  const aKnown =
    getFieldDefinition(a.value, getFieldDefinitionType(traceItemType)) !== null;
  const bKnown =
    getFieldDefinition(b.value, getFieldDefinitionType(traceItemType)) !== null;
  if (aKnown !== bKnown) return aKnown ? -1 : 1;
  const aLabel = typeof a.label === 'string' ? a.label : (a.textValue ?? '');
  const bLabel = typeof b.label === 'string' ? b.label : (b.textValue ?? '');
  return aLabel.localeCompare(bLabel);
}
