import {COL_WIDTH_UNDEFINED} from '@sentry/scraps/table';

import type {MetaType} from 'sentry/utils/discover/eventView';
import type {ColumnValueType, Field} from 'sentry/utils/discover/fields';
import {
  aggregateFunctionOutputType,
  AGGREGATIONS,
  explodeFieldString,
  getEquation,
  isEquation,
  isMeasurement,
  isSpanOperationBreakdownField,
  measurementType,
} from 'sentry/utils/discover/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import type {TableColumn} from 'sentry/views/discover/table/types';

const TEMPLATE_TABLE_COLUMN: TableColumn<string> = {
  key: '',
  name: '',

  type: 'never',
  isSortable: false,

  column: Object.freeze({kind: 'field', field: ''}),
  width: COL_WIDTH_UNDEFINED,
};

export function decodeColumnOrder(
  fields: readonly Field[],
  meta?: MetaType
): Array<TableColumn<string>> {
  return fields.map((f: Field) => {
    const column: TableColumn<string> = {...TEMPLATE_TABLE_COLUMN};

    const col = explodeFieldString(f.field, f.alias);
    if (isEquation(f.field)) {
      column.key = f.field;
      column.name = getEquation(f.field);
      column.type = 'number';
    } else {
      column.key = f.field;
      column.name = f.field;
    }
    column.width = f.width || COL_WIDTH_UNDEFINED;

    if (col.kind === 'function') {
      // Aggregations can have a strict outputType or they can inherit from their field.
      // Otherwise use the FIELDS data to infer types.
      const outputType = aggregateFunctionOutputType(col.function[0], col.function[1]);
      if (outputType !== null) {
        column.type = outputType;
      }
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const aggregate = AGGREGATIONS[col.function[0]];
      column.isSortable = aggregate?.isSortable;
    } else if (col.kind === 'field') {
      if (getFieldDefinition(col.field) !== null) {
        column.type = getFieldDefinition(col.field)?.valueType as ColumnValueType;
      } else if (isMeasurement(col.field)) {
        column.type = measurementType(col.field);
      } else if (isSpanOperationBreakdownField(col.field)) {
        column.type = 'duration';
      }
    }

    // If provided meta with field type, prioritize that over guessing
    if (meta?.fields?.[column.key]) {
      column.type = meta.fields[column.key];
    }

    column.column = col;

    return column;
  });
}
