import type {SelectOption} from '@sentry/scraps/compactSelect';

import type {Tag, TagCollection} from 'sentry/types/group';
import {classifyTagKey, FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export function optionFromTag(tag: Tag, traceItemType: TraceItemDataset) {
  return {
    label: tag.name,
    value: tag.key,
    textValue: tag.key,
    trailingItems: <TypeBadge kind={tag.kind} />,
    showDetailsInOverlay: true,
    details: (
      <AttributeDetails
        column={tag.key}
        kind={tag.kind}
        label={tag.name}
        traceItemType={traceItemType}
      />
    ),
  };
}

interface BuildAttributeOptionsParams {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  traceItemType: TraceItemDataset;
  /**
   * How to determine the kind for extra columns. Pass a concrete `FieldKind`
   * to hardcode one, or a function to derive it per column. Defaults to
   * `classifyTagKey`.
   */
  extraColumnKind?: FieldKind | ((column: string) => FieldKind);
  /**
   * Extra columns that should be rendered as options even if they are not
   * present in any of the tag collections.
   */
  extraColumns?: readonly string[];
}

export function buildAttributeOptions({
  booleanTags,
  numberTags,
  stringTags,
  traceItemType,
  extraColumns = [],
  extraColumnKind = classifyTagKey,
}: BuildAttributeOptionsParams): Array<SelectOption<string>> {
  const resolveKind =
    typeof extraColumnKind === 'function' ? extraColumnKind : () => extraColumnKind;

  // Order matters: callers that dedup downstream (e.g. useGroupByFields) keep
  // the first occurrence by `option.value`. Number/MEASUREMENT comes before
  // string/TAG and boolean/BOOLEAN so that a key present in multiple typed
  // collections preserves its measurement variant, matching the hand-rolled
  // ordering before this helper was extracted.
  return [
    ...Object.values(numberTags).map(tag => optionFromTag(tag, traceItemType)),
    ...Object.values(stringTags).map(tag => optionFromTag(tag, traceItemType)),
    ...Object.values(booleanTags).map(tag => optionFromTag(tag, traceItemType)),
    ...extraColumns
      .filter(
        column =>
          column &&
          !(column in stringTags) &&
          !(column in numberTags) &&
          !(column in booleanTags)
      )
      .map(column =>
        optionFromTag(
          {key: column, name: prettifyTagKey(column), kind: resolveKind(column)},
          traceItemType
        )
      ),
  ];
}
