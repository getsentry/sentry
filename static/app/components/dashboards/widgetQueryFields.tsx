import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {
  aggregateFunctionOutputType,
  explodeField,
  generateFieldAsString,
  isLegalYAxisType,
  QueryFieldValue,
} from 'app/utils/discover/fields';
import {Widget} from 'app/views/dashboardsV2/types';
import ColumnEditCollection from 'app/views/eventsV2/table/columnEditCollection';
import {QueryField} from 'app/views/eventsV2/table/queryField';
import {FieldValueKind} from 'app/views/eventsV2/table/types';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import Field from 'app/views/settings/components/forms/field';

type Props = {
  /**
   * The widget type. Used to render different fieldsets.
   */
  displayType: Widget['displayType'];
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  /**
   * The field list for the widget.
   */
  fields: string[];
  /**
   * Fired when fields are added/removed/modified/reordered.
   */
  onChange: (fields: string[]) => void;
  /**
   * Any errors that need to be rendered.
   */
  organization: Organization;
  errors?: Record<string, any>;
  style?: React.CSSProperties;
};

function WidgetQueryFields({
  displayType,
  errors,
  fields,
  fieldOptions,
  organization,
  onChange,
  style,
}: Props) {
  // Handle new fields being added.
  function handleAdd(event: React.MouseEvent) {
    event.preventDefault();

    const newFields = [...fields, ''];
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
    newFields[fieldIndex] = generateFieldAsString(value);
    onChange(newFields);
  }

  function handleColumnChange(columns: QueryFieldValue[]) {
    const newFields = columns.map(generateFieldAsString);
    onChange(newFields);
  }

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
          columns={fields.map(field => explodeField({field}))}
          onChange={handleColumnChange}
          fieldOptions={fieldOptions}
          organization={organization}
        />
      </Field>
    );
  }

  const hideAddYAxisButton =
    (['world_map', 'big_number'].includes(displayType) && fields.length === 1) ||
    (['line', 'area', 'stacked_area', 'bar'].includes(displayType) &&
      fields.length === 3);

  // Any function/field choice for Big Number widgets is legal since the
  // data source is from an endpoint that is not timeseries-based.
  // The function/field choice for World Map widget will need to be numeric-like.
  // Column builder for Table widget is already handled above.
  const doNotValidateYAxis = displayType === 'big_number';

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
        const fieldValue = explodeField({field});
        return (
          <QueryFieldWrapper key={`${field}:${i}`}>
            <QueryField
              fieldValue={fieldValue}
              fieldOptions={fieldOptions}
              onChange={value => handleChangeField(value, i)}
              filterPrimaryOptions={option => {
                // Only validate function names for timeseries widgets and
                // world map widgets.
                if (
                  !doNotValidateYAxis &&
                  option.value.kind === FieldValueKind.FUNCTION
                ) {
                  const primaryOutput = aggregateFunctionOutputType(
                    option.value.meta.name,
                    undefined
                  );
                  if (primaryOutput) {
                    // If a function returns a specific type, then validate it.
                    return isLegalYAxisType(primaryOutput);
                  }
                }

                return option.value.kind === FieldValueKind.FUNCTION;
              }}
              filterAggregateParameters={option => {
                // Only validate function parameters for timeseries widgets and
                // world map widgets.
                if (doNotValidateYAxis) {
                  return true;
                }

                if (fieldValue.kind !== 'function') {
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
              }}
            />
            {fields.length > 1 && (
              <Button
                size="zero"
                borderless
                onClick={event => handleRemove(event, i)}
                icon={<IconDelete />}
                title={t('Remove this Y-Axis')}
                label={t('Remove this Y-Axis')}
              />
            )}
          </QueryFieldWrapper>
        );
      })}
      {!hideAddYAxisButton && (
        <div>
          <Button size="small" icon={<IconAdd isCircled />} onClick={handleAdd}>
            {t('Add Overlay')}
          </Button>
        </div>
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

export default WidgetQueryFields;
