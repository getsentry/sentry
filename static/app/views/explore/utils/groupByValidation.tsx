import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

export function filterInvalidGroupBys(
  groupBys: readonly string[],
  fields: EventValidationData['field'] | undefined
): string[] {
  const invalidFields = new Set(
    fields?.filter(field => !field.valid).map(field => field.name)
  );

  if (invalidFields.size === 0) {
    return [...groupBys];
  }

  return groupBys.filter(groupBy => groupBy === '' || !invalidFields.has(groupBy));
}

export function filterVisibleGroupBys(
  groupBys: readonly string[],
  fields: EventValidationData['field'] | undefined,
  validationIsPending: boolean
): string[] {
  return groupBys.filter(
    groupBy => !shouldHideGroupByForValidation(groupBy, fields, validationIsPending)
  );
}

export function shouldHideGroupByForValidation(
  groupBy: string,
  fields: EventValidationData['field'] | undefined,
  validationIsPending: boolean
): boolean {
  if (groupBy === '') {
    return false;
  }

  const field = fields?.find(({name}) => name === groupBy);

  if (field?.valid) {
    return false;
  }

  return validationIsPending || field?.valid === false;
}

export function mergeValidatedGroupByTags({
  booleanTags,
  numberTags,
  stringTags,
  validatedFields = [],
}: {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  validatedFields?: EventValidationData['field'];
}) {
  const validatedBooleanTags = {...booleanTags};
  const validatedNumberTags = {...numberTags};
  const validatedStringTags = {...stringTags};

  for (const validatedField of validatedFields) {
    if (!validatedField.valid) {
      continue;
    }

    const tag = {
      key: validatedField.name,
      name: prettifyAttributeName(validatedField.name),
    };

    if (validatedField.attrType === 'boolean') {
      validatedBooleanTags[validatedField.name] = {...tag, kind: FieldKind.BOOLEAN};
    } else if (validatedField.attrType === 'number') {
      validatedNumberTags[validatedField.name] = {...tag, kind: FieldKind.MEASUREMENT};
    } else if (validatedField.attrType === 'string') {
      validatedStringTags[validatedField.name] = {...tag, kind: FieldKind.TAG};
    }
  }

  return {validatedBooleanTags, validatedNumberTags, validatedStringTags};
}
