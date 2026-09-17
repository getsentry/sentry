import type {TagCollection} from 'sentry/types/group';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {parseConditionalAggregate} from 'sentry/views/explore/utils/conditionalAggregate';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

export interface AttributeCollections {
  boolean: TagCollection;
  number: TagCollection;
  string: TagCollection;
  array?: TagCollection;
}

export function getColumnFieldsForValidation({
  aggregateFields,
  fields,
}: {
  aggregateFields: readonly AggregateField[];
  fields: readonly string[];
}): string[] {
  const fieldsForValidation = new Set(fields);

  for (const aggregateField of aggregateFields) {
    if (isGroupBy(aggregateField)) {
      if (aggregateField.groupBy) {
        fieldsForValidation.add(aggregateField.groupBy);
      }
      continue;
    }

    fieldsForValidation.add(aggregateField.yAxis);
    // Parse conditionally so an `_if` filter query is not mistaken for an attribute.
    const conditional = parseConditionalAggregate(aggregateField.yAxis);
    for (const argument of conditional?.arguments ?? []) {
      if (argument) {
        fieldsForValidation.add(argument);
      }
    }
  }

  return Array.from(fieldsForValidation);
}

export function getValidatedColumnData({
  aggregateFields,
  attributes,
  fields,
  validationData,
}: {
  aggregateFields: readonly AggregateField[];
  attributes: AttributeCollections;
  fields: readonly string[];
  validationData?: EventValidationData;
}) {
  const validatedAttributes = {
    boolean: {...attributes.boolean},
    number: {...attributes.number},
    string: {...attributes.string},
    array: {...attributes.array},
  };
  const fieldTypes: Partial<Record<string, FieldValueType>> = {};
  const invalidFields = new Set<string>();
  const aggregateExpressions = new Set<string>();

  for (const aggregateField of aggregateFields) {
    if (!isGroupBy(aggregateField)) {
      aggregateExpressions.add(aggregateField.yAxis);
    }
  }

  for (const item of validationData?.field ?? []) {
    if (!item.name) {
      continue;
    }

    if (!item.valid) {
      invalidFields.add(item.name);
      continue;
    }

    // The attributes endpoint types arrays authoritatively (gated behind the
    // array feature flag). Trust it even when the validate endpoint reports a
    // scalar type for the same attribute, so a picked array column keeps its
    // array type regardless of whether the backend validate change has shipped
    // yet. When the flag is off, attributes.array is empty and this is a no-op.
    const isArrayAttribute =
      item.attrType === 'array' || Boolean(attributes.array?.[item.name]);

    if (isArrayAttribute) {
      fieldTypes[item.name] = FieldValueType.ARRAY;
    } else if (item.attrType === 'boolean') {
      fieldTypes[item.name] = FieldValueType.BOOLEAN;
    } else if (item.attrType === 'number') {
      fieldTypes[item.name] = FieldValueType.NUMBER;
    } else if (item.attrType === 'string') {
      fieldTypes[item.name] = FieldValueType.STRING;
    }

    if (aggregateExpressions.has(item.name)) {
      continue;
    }

    if (isArrayAttribute) {
      delete validatedAttributes.boolean[item.name];
      delete validatedAttributes.number[item.name];
      delete validatedAttributes.string[item.name];
      validatedAttributes.array[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.ARRAY,
      };
    } else if (item.attrType === 'boolean') {
      delete validatedAttributes.number[item.name];
      delete validatedAttributes.string[item.name];
      delete validatedAttributes.array[item.name];
      validatedAttributes.boolean[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.BOOLEAN,
      };
    } else if (item.attrType === 'number') {
      delete validatedAttributes.boolean[item.name];
      delete validatedAttributes.string[item.name];
      delete validatedAttributes.array[item.name];
      validatedAttributes.number[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.MEASUREMENT,
      };
    } else if (item.attrType === 'string') {
      delete validatedAttributes.boolean[item.name];
      delete validatedAttributes.number[item.name];
      delete validatedAttributes.array[item.name];
      validatedAttributes.string[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.TAG,
      };
    }
  }

  return {
    aggregateFields: getValidatedAggregateFields({aggregateFields, invalidFields}),
    attributes: validatedAttributes,
    fieldTypes,
    fields: fields.filter(field => !invalidFields.has(field)),
  };
}

function getValidatedAggregateFields({
  aggregateFields,
  invalidFields,
}: {
  aggregateFields: readonly AggregateField[];
  invalidFields: ReadonlySet<string>;
}): AggregateField[] {
  return aggregateFields.filter(aggregateField => {
    if (isGroupBy(aggregateField)) {
      return !invalidFields.has(aggregateField.groupBy);
    }

    const conditional = parseConditionalAggregate(aggregateField.yAxis);

    // A series carrying an `_if` filter is validated as one expression, so an invalid
    // filter query cannot be told apart from an invalid aggregate. Keep the series so an
    // errored query is reported by its search bar instead of being thrown away, matching
    // the main search. The argument check below still catches a bad aggregate.
    if (!conditional?.filter && invalidFields.has(aggregateField.yAxis)) {
      return false;
    }

    // Only the base aggregate arguments are attributes; `_if` filter queries are not.
    return !conditional?.arguments.some(
      argument => argument && invalidFields.has(argument)
    );
  });
}
