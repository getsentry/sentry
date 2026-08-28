import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Aggregation, ColumnType} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

/**
 * The column type an EAP attribute's kind maps to. Drives the type badge shown
 * next to the attribute and which aggregates accept it as a parameter.
 */
export function eapAttributeDataType(kind: TagCollection[string]['kind']): ColumnType {
  if (kind === FieldKind.MEASUREMENT) {
    return 'number';
  }
  if (kind === FieldKind.BOOLEAN) {
    return 'boolean';
  }
  return 'string';
}

export function combineBaseFieldsWithTags(
  organization: Organization,
  tags: TagCollection | undefined,
  aggregations: Record<string, Aggregation>
): Record<string, FieldValueOption> {
  const baseFieldOptions = generateFieldOptions({
    organization,
    tagKeys: [],
    fieldKeys: [],
    aggregations,
  });

  const processedTags = Object.values(tags ?? {}).reduce<
    Record<string, FieldValueOption>
  >((acc, tag) => {
    acc[`${tag.kind}:${tag.key}`] = {
      label: tag.name,
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: tag.key, dataType: eapAttributeDataType(tag.kind)},
      },
    };
    return acc;
  }, {});

  return {...baseFieldOptions, ...processedTags};
}
