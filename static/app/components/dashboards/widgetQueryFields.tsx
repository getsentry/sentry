import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {
  aggregateFunctionOutputType,
  isLegalYAxisType,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import ColumnEditCollection from 'sentry/views/eventsV2/table/columnEditCollection';
import {FieldValueOption, QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

type Props = {
  /**
   * The widget display type. Used to render different fieldsets.
   */
  displayType: Widget['displayType'];
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  /**
   * The field list for the widget.
   */
  fields: QueryFieldValue[];
  /**
   * Fired when fields are added/removed/modified/reordered.
   */
  onChange: (fields: QueryFieldValue[]) => void;
  /**
   * Any errors that need to be rendered.
   */
  organization: Organization;
  widgetType: Widget['widgetType'];
  errors?: Record<string, any>;
  style?: React.CSSProperties;
};

function WidgetQueryFields({
  widgetType,
  displayType,
  errors,
  fields,
  fieldOptions,
  organization,
  onChange,
  style,
}: Props) {
  const isMetricWidget = widgetType === WidgetType.METRICS;

  // Handle new fields being added.
  function handleAdd(event: React.MouseEvent) {
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

  function handleRemove(event: React.MouseEvent, fieldIndex: number) {
    event.preventDefault();

    const newFields = [...fields];
    newFields.splice(fieldIndex, 1);
    onChange(newFields);
  }

  function handleChangeField(value: QueryFieldValue, fieldIndex: number) {
    const newFields = [...fields];
    newFields[fieldIndex] = value;
    onChange(newFields);
  }

  function handleTopNChangeField(value: QueryFieldValue) {
    const newFields = [...fields];
    newFields[fields.length - 1] = value;
    onChange(newFields);
  }

  function handleTopNColumnChange(columns: QueryFieldValue[]) {
    const newFields = [...columns, fields[fields.length - 1]];
    onChange(newFields);
  }

  function handleColumnChange(columns: QueryFieldValue[]) {
    onChange(columns);
  }

  // Any function/field choice for Big Number widgets is legal since the
  // data source is from an endpoint that is not timeseries-based.
  // The function/field choice for World Map widget will need to be numeric-like.
  // Column builder for Table widget is already handled above.
  const doNotValidateYAxis = displayType === 'big_number';

  const filterPrimaryOptions = option => {
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
  };

  const filterMetricsOptions = option => {
    return option.value.kind === FieldValueKind.FUNCTION;
  };

  const filterAggregateParameters =
    (fieldValue: QueryFieldValue) => (option: FieldValueOption) => {
      // Only validate function parameters for timeseries widgets and
      // world map widgets.
      if (doNotValidateYAxis) {
        return true;
      }

      if (fieldValue.kind !== 'function') {
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

  const hideAddYAxisButton =
    (['world_map', 'big_number'].includes(displayType) && fields.length === 1) ||
    (['line', 'area', 'stacked_area', 'bar'].includes(displayType) &&
      fields.length === 3);

  const canDelete = fields.length > 1;

  if (displayType === 'table') {
    return (
      <Field
        data-test-id="columns"
        label={t('Columns')}
        inline={false}
        style={{padding: `${space(1)} 0`, ...(style ?? {})}}
        error={errors?.fields}
        flexibleControlStateSize
        stacked
        required
      >
        <StyledColumnEditCollection
          columns={fields}
          onChange={handleColumnChange}
          fieldOptions={fieldOptions}
          organization={organization}
          filterPrimaryOptions={isMetricWidget ? filterPrimaryOptions : undefined}
          source={widgetType}
        />
      </Field>
    );
  }

  if (displayType === 'top_n') {
    const fieldValue = fields[fields.length - 1];
    const columns = fields.slice(0, fields.length - 1);

    return (
      <React.Fragment>
        <Field
          data-test-id="columns"
          label={t('Columns')}
          inline={false}
          style={{padding: `${space(1)} 0`, ...(style ?? {})}}
          error={errors?.fields}
          flexibleControlStateSize
          stacked
          required
        >
          <StyledColumnEditCollection
            columns={columns}
            onChange={handleTopNColumnChange}
            fieldOptions={fieldOptions}
            organization={organization}
            filterPrimaryOptions={isMetricWidget ? filterPrimaryOptions : undefined}
            source={widgetType}
          />
        </Field>
        <Field
          data-test-id="y-axis"
          label={t('Y-Axis')}
          inline={false}
          style={{padding: `${space(2)} 0 24px 0`, ...(style ?? {})}}
          flexibleControlStateSize
          error={errors?.fields}
          required
          stacked
        >
          <QueryFieldWrapper key={`${fieldValue}:0`}>
            <QueryField
              fieldValue={fieldValue}
              fieldOptions={
                isMetricWidget ? fieldOptions : generateFieldOptions({organization})
              }
              onChange={value => handleTopNChangeField(value)}
              filterPrimaryOptions={
                isMetricWidget ? filterMetricsOptions : filterPrimaryOptions
              }
              filterAggregateParameters={filterAggregateParameters(fieldValue)}
            />
          </QueryFieldWrapper>
        </Field>
      </React.Fragment>
    );
  }

  return (
    <Field
      data-test-id="y-axis"
      label={t('Y-Axis')}
      inline={false}
      style={{padding: `${space(2)} 0 24px 0`, ...(style ?? {})}}
      flexibleControlStateSize
      error={errors?.fields}
      required
      stacked
    >
      {fields.map((field, i) => {
        return (
          <QueryFieldWrapper key={`${field}:${i}`}>
            <QueryField
              fieldValue={field}
              fieldOptions={fieldOptions}
              onChange={value => handleChangeField(value, i)}
              filterPrimaryOptions={filterPrimaryOptions}
              filterAggregateParameters={filterAggregateParameters(field)}
              otherColumns={fields}
            />
            {(canDelete || field.kind === 'equation') && (
              <Button
                size="zero"
                borderless
                onClick={event => handleRemove(event, i)}
                icon={<IconDelete />}
                title={t('Remove this Y-Axis')}
                aria-label={t('Remove this Y-Axis')}
              />
            )}
          </QueryFieldWrapper>
        );
      })}
      {!hideAddYAxisButton && (
        <Actions>
          <Button size="small" icon={<IconAdd isCircled />} onClick={handleAdd}>
            {t('Add Overlay')}
          </Button>
          <Button
            size="small"
            aria-label={t('Add an Equation')}
            onClick={handleAddEquation}
            icon={<IconAdd isCircled />}
          >
            {t('Add an Equation')}
          </Button>
        </Actions>
      )}
    </Field>
  );
}

const StyledColumnEditCollection = styled(ColumnEditCollection)`
  margin-top: ${space(1)};
`;

export const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }
`;

const Actions = styled('div')`
  grid-column: 2 / 3;

  & button {
    margin-right: ${space(1)};
  }
`;

export default WidgetQueryFields;
