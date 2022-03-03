import React from 'react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import Field from 'sentry/components/forms/field';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  aggregateFunctionOutputType,
  isLegalYAxisType,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {FieldValueOption, QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {AddButton} from './addButton';
import {DeleteButton} from './deleteButton';

type Props = {
  displayType: DisplayType;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  fields: QueryFieldValue[];
  /**
   * Fired when fields are added/removed/modified/reordered.
   */
  onChange: (fields: QueryFieldValue[]) => void;
  widgetType: Widget['widgetType'];
  errors?: Record<string, any>;
};

export function YAxisSelector({
  displayType,
  widgetType,
  fields,
  fieldOptions,
  onChange,
  errors,
}: Props) {
  const organization = useOrganization();
  const isMetricWidget = widgetType === WidgetType.METRICS;

  function handleAddOverlay(event: React.MouseEvent) {
    event.preventDefault();

    const newFields = [
      ...fields,
      {kind: FieldValueKind.FIELD, field: ''} as QueryFieldValue,
    ];
    onChange(newFields);
  }

  function handleAddEquation(event: React.MouseEvent) {
    event.preventDefault();

    const newFields = [
      ...fields,
      {kind: FieldValueKind.EQUATION, field: ''} as QueryFieldValue,
    ];
    onChange(newFields);
  }

  function handleRemoveQueryField(event: React.MouseEvent, fieldIndex: number) {
    event.preventDefault();

    const newFields = [...fields];
    newFields.splice(fieldIndex, 1);
    onChange(newFields);
  }

  function handleChangeQueryField(value: QueryFieldValue, fieldIndex: number) {
    const newFields = [...fields];
    newFields[fieldIndex] = value;
    onChange(newFields);
  }

  function handleTopNChangeField(value: QueryFieldValue) {
    const newFields = [...fields];
    newFields[fields.length - 1] = value;
    onChange(newFields);
  }

  // Any function/field choice for Big Number widgets is legal since the
  // data source is from an endpoint that is not timeseries-based.
  // The function/field choice for World Map widget will need to be numeric-like.
  // Column builder for Table widget is already handled above.
  const doNotValidateYAxis = displayType === DisplayType.BIG_NUMBER;

  function filterPrimaryOptions(option: FieldValueOption) {
    // Only validate function names for timeseries widgets and
    // world map widgets.
    if (!doNotValidateYAxis && option.value.kind === FieldValueKind.FUNCTION) {
      const primaryOutput = aggregateFunctionOutputType(
        option.value.meta.name,
        undefined
      );
      if (primaryOutput) {
        // If a function returns a specific type, then validate it.
        return isLegalYAxisType(primaryOutput);
      }
    }

    if (
      widgetType === WidgetType.METRICS &&
      (displayType === DisplayType.TABLE || displayType === DisplayType.TOP_N)
    ) {
      return (
        option.value.kind === FieldValueKind.FUNCTION ||
        option.value.kind === FieldValueKind.TAG
      );
    }

    return option.value.kind === FieldValueKind.FUNCTION;
  }

  function filterAggregateParameters(fieldValue: QueryFieldValue) {
    return (option: FieldValueOption) => {
      // Only validate function parameters for timeseries widgets and
      // world map widgets.
      if (doNotValidateYAxis) {
        return true;
      }

      if (fieldValue.kind !== FieldValueKind.FUNCTION) {
        return true;
      }

      if (isMetricWidget || option.value.kind === FieldValueKind.METRICS) {
        return true;
      }

      const functionName = fieldValue.function[0];
      const primaryOutput = aggregateFunctionOutputType(
        functionName as string,
        option.value.meta.name
      );
      if (primaryOutput) {
        return isLegalYAxisType(primaryOutput);
      }

      if (option.value.kind === FieldValueKind.FUNCTION) {
        // Functions are not legal options as an aggregate/function parameter.
        return false;
      }

      return isLegalYAxisType(option.value.meta.dataType);
    };
  }

  const fieldError = errors?.find(error => error?.fields)?.fields;

  if (displayType === DisplayType.TOP_N) {
    const fieldValue = fields[fields.length - 1];
    return (
      <Field inline={false} flexibleControlStateSize error={fieldError} required stacked>
        <QueryFieldWrapper>
          <QueryField
            fieldValue={fieldValue}
            fieldOptions={generateFieldOptions({organization})}
            onChange={handleTopNChangeField}
            filterPrimaryOptions={filterPrimaryOptions}
            filterAggregateParameters={filterAggregateParameters(fieldValue)}
          />
        </QueryFieldWrapper>
      </Field>
    );
  }

  const canDelete = fields.length > 1;

  const hideAddYAxisButtons =
    ([DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(displayType) &&
      fields.length === 1) ||
    ([
      DisplayType.LINE,
      DisplayType.AREA,
      DisplayType.STACKED_AREA,
      DisplayType.BAR,
    ].includes(displayType) &&
      fields.length === 3);

  return (
    <Field inline={false} flexibleControlStateSize error={fieldError} required stacked>
      {fields.map((fieldValue, i) => (
        <QueryFieldWrapper key={`${fieldValue}:${i}`}>
          <QueryField
            fieldValue={fieldValue}
            fieldOptions={fieldOptions}
            onChange={value => handleChangeQueryField(value, i)}
            filterPrimaryOptions={filterPrimaryOptions}
            filterAggregateParameters={filterAggregateParameters(fieldValue)}
            otherColumns={fields}
          />
          {(canDelete || fieldValue.kind === FieldValueKind.EQUATION) && (
            <DeleteButton onDelete={event => handleRemoveQueryField(event, i)} />
          )}
        </QueryFieldWrapper>
      ))}
      {!hideAddYAxisButtons && (
        <Actions gap={1}>
          <AddButton title={t('Add Overlay')} onAdd={handleAddOverlay} />
          <AddButton title={t('Add an Equation')} onAdd={handleAddEquation} />
        </Actions>
      )}
    </Field>
  );
}

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;

  :not(:last-child) {
    margin-bottom: ${space(1)};
  }

  > * + * {
    margin-left: ${space(1)};
  }
`;

const Actions = styled(ButtonBar)`
  justify-content: flex-start;
`;
