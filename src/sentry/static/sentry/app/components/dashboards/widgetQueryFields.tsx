import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  explodeField,
  generateFieldAsString,
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
  errors?: Record<string, any>;
  style?: React.CSSProperties;
};

function WidgetQueryFields({
  displayType,
  errors,
  fields,
  fieldOptions,
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
        style={{padding: `8px 0`, ...(style ?? {})}}
        error={errors?.fields}
        flexibleControlStateSize
        stacked
        required
      >
        <StyledColumnEditCollection
          columns={fields.map(field => explodeField({field}))}
          onChange={handleColumnChange}
          fieldOptions={fieldOptions}
        />
      </Field>
    );
  }

  const hideAddYAxisButton =
    (['world_map', 'big_number'].includes(displayType) && fields.length === 1) ||
    (['line', 'area', 'stacked_area', 'bar'].includes(displayType) &&
      fields.length === 3);

  return (
    <Field
      data-test-id="y-axis"
      label={t('Y-Axis')}
      inline={false}
      style={{padding: `16px 0 24px 0`, ...(style ?? {})}}
      flexibleControlStateSize
      error={errors?.fields}
      required
      stacked
    >
      {fields.map((field, i) => (
        <QueryFieldWrapper key={`${field}:${i}`}>
          <QueryField
            fieldValue={explodeField({field})}
            fieldOptions={fieldOptions}
            onChange={value => handleChangeField(value, i)}
            filterPrimaryOptions={option => {
              return option.value.kind === FieldValueKind.FUNCTION;
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
      ))}
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
