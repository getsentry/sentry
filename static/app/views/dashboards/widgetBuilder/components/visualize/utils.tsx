import {type ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {CompactSelect, TriggerLabel} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, type FlexProps} from '@sentry/scraps/layout';
import type {SelectValue} from '@sentry/scraps/select';

import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {
  DEPRECATED_FIELDS,
  type QueryFieldValue,
  type ValidateColumnTypes,
} from 'sentry/utils/discover/fields';
import {FieldValueType, prettifyTagKey} from 'sentry/utils/fields';
import {WidgetType} from 'sentry/views/dashboards/types';
import {ArithmeticInput} from 'sentry/views/discover/table/arithmeticInput';
import {validateColumnTypes} from 'sentry/views/discover/table/queryField';
import {FieldValueKind, type FieldValue} from 'sentry/views/discover/table/types';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {withBaseConditionalAggregateField} from 'sentry/views/explore/utils/conditionalAggregate';

export const NONE = 'none';

function formatColumnOptions(
  dataset: WidgetType,
  options: Array<SelectValue<FieldValue>>,
  columnFilterMethod: (
    option: SelectValue<FieldValue>,
    field?: QueryFieldValue
  ) => boolean,
  field: QueryFieldValue
) {
  return options
    .filter(option => {
      // Don't show any aggregates under the columns
      return option.value.kind !== FieldValueKind.FUNCTION;
    })
    .map(option => {
      const supported = columnFilterMethod ? columnFilterMethod(option, field) : false;
      return {
        value: option.value.meta.name,
        label:
          dataset === WidgetType.SPANS || dataset === WidgetType.LOGS
            ? prettifyTagKey(option.value.meta.name)
            : option.value.meta.name,

        trailingItems: () => {
          return renderTag(
            option.value.kind,
            option.value.meta.name,
            option.value.kind !== FieldValueKind.FUNCTION &&
              option.value.kind !== FieldValueKind.EQUATION
              ? option.value.meta.dataType
              : undefined
          );
        },
        disabled: !supported,
        tooltip: ({disabled}: {disabled: boolean}) => {
          return disabled && field.kind === FieldValueKind.FUNCTION
            ? tct('This field is not available for the [aggregate] function', {
                aggregate: <strong>{field.function[0]}</strong>,
              })
            : undefined;
        },
      };
    });
}

export function _sortFn(
  a: SelectValue<string> & {value: string; label?: string | ReactNode},
  b: SelectValue<string> & {value: string; label?: string | ReactNode}
) {
  // The labels should always be strings in this component, but we'll
  // handle the cases where they are not.
  if (typeof a.label !== 'string' || typeof b.label !== 'string') {
    return 0;
  }
  if (!defined(a.label) || !defined(b.label)) {
    return 0;
  }

  if (a.disabled && b.disabled) {
    return a.label.localeCompare(b.label);
  }
  if (a.disabled) {
    return 1;
  }
  if (b.disabled) {
    return -1;
  }

  return a.label.localeCompare(b.label);
}

export function getColumnOptions(
  dataset: WidgetType,
  selectedField: QueryFieldValue,
  fieldOptions: Record<string, SelectValue<FieldValue>>,
  columnFilterMethod: (
    option: SelectValue<FieldValue>,
    field?: QueryFieldValue
  ) => boolean,
  filterOutIncompatibleResults?: boolean
) {
  const fieldValues = Object.values(fieldOptions);
  // Explore-style `_if` fields explode with names like `count_unique_if`. Use the
  // base aggregate when looking up parameter metadata and filtering columns.
  const fieldForColumnFiltering =
    dataset === WidgetType.SPANS
      ? withBaseConditionalAggregateField(selectedField)
      : selectedField;

  if (
    fieldForColumnFiltering.kind !== FieldValueKind.FUNCTION ||
    dataset === WidgetType.SPANS ||
    dataset === WidgetType.LOGS
  ) {
    // For SPANS/LOGS functions, check for dropdown parameters before returning
    // generic columns. Functions like performance_score and opportunity_score
    // define restricted dropdown options that must be respected.
    if (
      fieldForColumnFiltering.kind === FieldValueKind.FUNCTION &&
      (dataset === WidgetType.SPANS || dataset === WidgetType.LOGS)
    ) {
      const fnData = fieldValues.find(
        option => option.value.meta.name === fieldForColumnFiltering.function[0]
      )?.value;
      if (
        fnData?.kind === FieldValueKind.FUNCTION &&
        fnData.meta.parameters.length > 0 &&
        fnData.meta.parameters[0]?.kind === 'dropdown'
      ) {
        return fnData.meta.parameters[0].options;
      }
    }
    return formatColumnOptions(
      dataset,
      fieldValues,
      columnFilterMethod,
      fieldForColumnFiltering
    )
      .filter(option => (filterOutIncompatibleResults ? !option.disabled : true))
      .sort(_sortFn);
  }

  const fieldData = fieldValues.find(
    option => option.value.meta.name === fieldForColumnFiltering.function[0]
  )?.value;

  if (
    fieldData?.kind === FieldValueKind.FUNCTION &&
    fieldData.meta.parameters.length > 0 &&
    fieldData.meta.parameters[0]
  ) {
    const parameter = fieldData.meta.parameters[0];
    if (parameter?.kind === 'dropdown') {
      // Parameters for dropdowns are already formatted in the correct manner
      // for select fields
      return parameter.options;
    }

    if (parameter?.kind === 'column' && parameter.columnTypes) {
      // Release Health widgets are the only widgets that actually have different
      // columns than the aggregates accept. e.g. project will never be a valid
      // parameter for any of the aggregates.
      const allowedColumns =
        dataset === WidgetType.RELEASE
          ? fieldValues.filter(
              option =>
                option.value.kind === FieldValueKind.METRICS &&
                validateColumnTypes(
                  parameter.columnTypes as ValidateColumnTypes,
                  option.value
                )
            )
          : fieldValues;
      return formatColumnOptions(
        dataset,
        allowedColumns,
        (option, field) =>
          columnFilterMethod(option, field) &&
          (option.value.kind === FieldValueKind.FIELD ||
            option.value.kind === FieldValueKind.TAG ||
            option.value.kind === FieldValueKind.MEASUREMENT ||
            option.value.kind === FieldValueKind.CUSTOM_MEASUREMENT ||
            option.value.kind === FieldValueKind.METRICS ||
            option.value.kind === FieldValueKind.BREAKDOWN) &&
          validateColumnTypes(parameter.columnTypes as ValidateColumnTypes, option.value),
        selectedField
      ).sort(_sortFn);
    }
  }

  return formatColumnOptions(
    dataset,
    fieldValues,
    columnFilterMethod,
    selectedField
  ).sort(_sortFn);
}

// Prefixes a value with `function:` because we need to ensure tags
// and functions do not overlap in value for the dropdowns
// Conflicting values seems to cause duplicate aggregate options
export function getAggregateValueKey(value: string | undefined) {
  if (!value) {
    return '';
  }

  return `function:${value}`;
}

// When we set the aggregate, we need to split out the function prefix
export function parseAggregateFromValueKey(value: string) {
  if (!value.startsWith('function:')) {
    return value;
  }

  return value.split(':')[1];
}

export function renderTag(kind: FieldValueKind, label: string, dataType?: string) {
  return (
    <TypeBadge
      label={label}
      valueKind={kind}
      valueType={dataType as FieldValueType}
      deprecatedFields={DEPRECATED_FIELDS}
    />
  );
}

export const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1 auto;
  min-width: 0;

  > button {
    width: 100%;
  }
`;
export const AggregateCompactSelect = styled(CompactSelect)<{
  hasColumnParameter: boolean;
}>`
  ${p =>
    p.hasColumnParameter
      ? css`
          width: fit-content;
          left: 1px;

          ${TriggerLabel} {
            overflow: visible;
          }
        `
      : css`
          width: 100%;
        `}

  > button {
    width: 100%;
  }
`;

export const LegendAliasInput = styled(Input)``;

export const ParameterRefinements = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};

  > * {
    flex: 1;
  }
`;

export const FieldBar = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${p => p.theme.space.md};
  flex: 3;
  min-width: 0;
`;

export const PrimarySelectRow = styled('div')<{
  hasColumnParameter: boolean;
  elevated?: boolean;
}>`
  display: flex;
  width: 100%;
  min-width: 0;
  /* Raise above the same-row filter bar while a non-portaled CompactSelect is open.
     Do not put z-index on the sortable visualize wrapper — that regresses sibling
     row stacking (later series text painting over earlier dropdowns). */
  ${p =>
    p.elevated &&
    css`
      position: relative;
      z-index: ${p.theme.zIndex.dropdown};
    `}

  & ${ColumnCompactSelect} button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  & ${AggregateCompactSelect} button {
    ${p =>
      p.hasColumnParameter &&
      css`
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      `}
  }
`;

export function FieldRow(props: FlexProps) {
  return <Flex gap="md" width="100%" minWidth="0" {...props} />;
}

export const FieldExtras = styled('div')<{compact: boolean}>`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
  flex: ${p => (p.compact ? '0' : '1')};
  align-items: center;
`;

export const StyledArithmeticInput = styled(ArithmeticInput)`
  width: 100%;
`;
