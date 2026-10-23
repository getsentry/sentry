import type {
  SearchMatchResult,
  SelectKey,
  SelectOption,
  SelectOptionWithKey,
} from '@sentry/scraps/compactSelect';

import {
  getFieldDefinition,
  isTypedTagKey,
  prettifyTagKey,
  type GetFieldDefinitionType,
} from 'sentry/utils/fields';
import {fzf} from 'sentry/utils/search/fzf';
import {TraceItemDataset} from 'sentry/views/explore/types';

type SortFieldDefinitionType = GetFieldDefinitionType | TraceItemDataset;

interface SortSearchedAttributesProps<Value extends SelectKey> {
  fieldDefinitionType: SortFieldDefinitionType;
  option: SelectOptionWithKey<Value>;
  searchText: string;
}

/**
 * Scores an attribute option for CompactSelect search results in Explore field pickers.
 *
 * Use this as a custom search/filter scorer when the menu should keep the existing
 * substring-only matching behavior, but rank matches with fzf and prefer known Sentry
 * field definitions over arbitrary custom attributes.
 */
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

  // A user attribute that shares a name with a Sentry field (e.g. `message`) has
  // the explicitly typed key `tags[message,string]` as its text, but it should
  // still match the search text `message`. Use the prettified key for scoring
  const displayText = prettifyTagKey(String(option.value));
  const normalizedDisplayText = displayText.toLowerCase();
  const scoreText = normalizedDisplayText.includes(normalizedSearch) ? displayText : text;

  const result = fzf(scoreText, normalizedSearch, false);
  if (result.end === -1) {
    return {score: 0};
  }

  const isKnown = isKnownAttribute(String(option.value), fieldDefinitionType);

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

/**
 * Sorts attribute options for Explore field pickers before the user enters search text.
 *
 * Use this for initial option lists where known Sentry field definitions should appear
 * before custom attributes, with each group sorted alphabetically by label.
 */
export function sortKnownAttributes<Value extends SelectOption<string>>(
  a: Value,
  b: Value,
  traceItemType: TraceItemDataset
) {
  const aKnown = isKnownAttribute(a.value, traceItemType);
  const bKnown = isKnownAttribute(b.value, traceItemType);
  if (aKnown !== bKnown) {
    return aKnown ? -1 : 1;
  }
  // Keeps known and user attributes with the same name in a stable order,
  // e.g. `message` then `tags[message,string]`.
  if (prettifyTagKey(a.value) === prettifyTagKey(b.value)) {
    return Number(isTypedTagKey(a.value)) - Number(isTypedTagKey(b.value));
  }
  const aLabel = typeof a.label === 'string' ? a.label : (a.textValue ?? '');
  const bLabel = typeof b.label === 'string' ? b.label : (b.textValue ?? '');
  return aLabel.localeCompare(bLabel);
}

/**
 * Whether the attribute is a known field (i.e., in Sentry conventions)
 */
function isKnownAttribute(key: string, fieldDefinitionType: SortFieldDefinitionType) {
  const definitionType = getFieldDefinitionType(fieldDefinitionType);
  if (getFieldDefinition(key, definitionType) !== null) {
    return true;
  }
  return (
    isTypedTagKey(key) && getFieldDefinition(prettifyTagKey(key), definitionType) !== null
  );
}
