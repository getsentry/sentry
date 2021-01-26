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
};

function WidgetQueryFields({displayType, errors, fields, fieldOptions, onChange}: Props) {
  // Handle new fields being added.
  function handleAdd(event: React.MouseEvent) {
    event.preventDefault();

    const newFields = [...fields, ''];
    onChange(newFields);
  }

  function handleRemove(event: React.MouseEvent, fieldIndex: number) {
    event.preventDefault();

    const newFields = [...fields];
    newFields.splice(fieldIndex, fieldIndex + 1);
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
        flexibleControlStateSize
        stacked
        error={errors?.fields}
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

  const showAddOverlay = !(displayType === 'world_map' && fields.length === 1);

  return (
    <Field
      data-test-id="y-axis"
      label={t('Y-Axis')}
      inline={false}
      flexibleControlStateSize
      stacked
      error={errors?.fields}
      required
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
              title={t('Remove this overlay')}
              label={t('Remove this overlay')}
            />
          )}
        </QueryFieldWrapper>
      ))}
      <div>
        {showAddOverlay && (
          <Button size="small" onClick={handleAdd} icon={<IconAdd isCircled />}>
            {t('Add an overlay')}
          </Button>
        )}
      </div>
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
