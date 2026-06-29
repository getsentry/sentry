import type {SelectValue} from '@sentry/scraps/select';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';

export type TraceItemColumnOption = SelectValue<string> & {
  label: string;
  value: string;
};

interface BuildTraceItemColumnOptionsParams {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
}

/**
 * Builds the column dropdown options for trace item datasets (spans, logs) from
 * the typed attribute collections returned by the `/attributes` endpoint. Shared
 * between the base option list and the search-while-typing merge so both render
 * identically.
 */
export function buildTraceItemColumnOptions({
  booleanTags,
  stringTags,
  numberTags,
}: BuildTraceItemColumnOptionsParams): TraceItemColumnOption[] {
  // `textValue` is set to the attribute key so the dropdown's search matcher
  // (sortSearchedAttributes scores `textValue ?? label`) filters on the key
  // rather than the prettified label. Otherwise a server match whose query hits
  // the key but not the display label would be filtered out client-side.
  return [
    ...Object.values(booleanTags).map(tag => ({
      label: tag.name,
      value: tag.key,
      textValue: tag.key,
      trailingItems: () => <TypeBadge kind={FieldKind.BOOLEAN} />,
    })),
    ...Object.values(stringTags).map(tag => ({
      label: tag.name,
      value: tag.key,
      textValue: tag.key,
      trailingItems: () => <TypeBadge kind={FieldKind.TAG} />,
    })),
    ...Object.values(numberTags).map(tag => ({
      label: prettifyTagKey(tag.name),
      value: tag.key,
      textValue: tag.key,
      trailingItems: () => <TypeBadge kind={FieldKind.MEASUREMENT} />,
    })),
  ];
}
