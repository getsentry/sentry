import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Aggregation} from 'sentry/utils/discover/fields';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

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

  const processedTags = Object.values(tags ?? {}).reduce(
    (acc, tag) => {
      acc[`${tag.kind}:${tag.key}`] = {
        label: tag.name,
        value: {
          kind: FieldValueKind.TAG,
          meta: {name: tag.key, dataType: tag.kind === 'tag' ? 'string' : 'number'},
        },
      };
      return acc;
    },
    {} as Record<string, FieldValueOption>
  );

  return {...baseFieldOptions, ...processedTags};
}
