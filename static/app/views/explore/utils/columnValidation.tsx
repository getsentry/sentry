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
    // Use parseConditionalAggregate so `_if` filter queries (e.g. `span.op:db`)
    // are not treated as attribute columns to validate.
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

    if (item.attrType === 'boolean') {
      fieldTypes[item.name] = FieldValueType.BOOLEAN;
    }

    if (item.attrType === 'number') {
      fieldTypes[item.name] = FieldValueType.NUMBER;
    }

    if (item.attrType === 'string') {
      fieldTypes[item.name] = FieldValueType.STRING;
    }

    if (aggregateExpressions.has(item.name)) {
      continue;
    }

    if (item.attrType === 'boolean') {
      delete validatedAttributes.number[item.name];
      delete validatedAttributes.string[item.name];
      validatedAttributes.boolean[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.BOOLEAN,
      };
    }

    if (item.attrType === 'number') {
      delete validatedAttributes.boolean[item.name];
      delete validatedAttributes.string[item.name];
      validatedAttributes.number[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.MEASUREMENT,
      };
    }

    if (item.attrType === 'string') {
      delete validatedAttributes.boolean[item.name];
      delete validatedAttributes.number[item.name];
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

    if (invalidFields.has(aggregateField.yAxis)) {
      return false;
    }

    // Only check base aggregate arguments — ignore `_if` filter queries.
    const conditional = parseConditionalAggregate(aggregateField.yAxis);
    return !conditional?.arguments.some(
      argument => argument && invalidFields.has(argument)
    );
  });
}
