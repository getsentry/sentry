import React from 'react';
import styled from '@emotion/styled';
import {components} from 'react-select';

import Badge from 'app/components/badge';
import SelectControl from 'app/components/forms/selectControl';
import {SelectValue} from 'app/types';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {FieldValueKind, FieldValue} from './types';
import {FIELD_ALIASES, AggregateParameter} from '../eventQueryParams';
import {Column} from '../eventView';

type FieldOptions = {[key: string]: SelectValue<FieldValue>};
type Props = {
  className?: string;
  parentIndex: number;
  column: Column;
  fieldOptions: FieldOptions;
  onChange: (index: number, column: Column) => void;
};

const NO_OPTIONS: SelectValue<string>[] = [{label: t('N/A'), value: ''}];

class ColumnEditRow extends React.Component<Props> {
  handleFieldChange = ({value}) => {
    const {column} = this.props;
    let field = column.field,
      aggregation = column.aggregation;

    switch (value.kind) {
      case FieldValueKind.TAG:
      case FieldValueKind.FIELD:
        field = value.meta.name;
        aggregation = '';
        break;
      case FieldValueKind.FUNCTION:
        aggregation = value.meta.name;
        // Backwards compatibility for field alias versions of functions.
        if (FIELD_ALIASES.includes(field)) {
          field = '';
        }
        break;
      default:
        throw new Error('Invalid field type found in column picker');
    }

    const currentField = this.getFieldOrTagValue(field);
    if (aggregation && currentField !== null) {
      const parameterSpec: AggregateParameter = value.meta.parameters[0];

      if (parameterSpec === undefined) {
        // New function has no parameter, clear the field
        field = '';
      } else if (
        (currentField.kind === FieldValueKind.FIELD ||
          currentField.kind === FieldValueKind.TAG) &&
        parameterSpec.columnTypes.includes(currentField.meta.dataType)
      ) {
        // New function accepts current field.
        field = currentField.meta.name;
      } else {
        // field does not fit within new function requirements.
        field = '';
      }
    }

    this.triggerChange(field, aggregation);
  };

  handleFieldParameterChange = ({value}) => {
    this.triggerChange(value.meta.name, this.props.column.aggregation);
  };

  triggerChange(field: string, aggregation: string) {
    const {parentIndex} = this.props;
    this.props.onChange(parentIndex, {
      field,
      aggregation,
    });
  }

  getFieldOrTagValue(name: string): FieldValue | null {
    const {fieldOptions} = this.props;
    const fieldName = `field:${name}`;
    const tagName = `tag:${name}`;
    if (fieldOptions[fieldName]) {
      return fieldOptions[fieldName].value;
    }
    if (fieldOptions[tagName]) {
      return fieldOptions[tagName].value;
    }

    // Likely a tag that was deleted but left behind in a saved query
    // Cook up a tag option so select control works.
    if (name.length > 0) {
      return {
        kind: FieldValueKind.TAG,
        meta: {
          name,
          dataType: 'string',
          unknown: true,
        },
      };
    }
    return null;
  }

  getFieldData() {
    let field: FieldValue | null = null,
      fieldParameter: FieldValue | null = null,
      fieldParameterOptions: SelectValue<FieldValue>[] = [];

    const {column} = this.props;
    let {fieldOptions} = this.props;
    const funcName = `function:${column.aggregation}`;

    if (fieldOptions[funcName] !== undefined) {
      field = fieldOptions[funcName].value;
      fieldParameter = this.getFieldOrTagValue(column.field);
    } else if (!column.aggregation && FIELD_ALIASES.includes(column.field)) {
      // Handle backwards compatible field aliases.
      const aliasName = `function:${column.field}`;
      if (fieldOptions[aliasName] !== undefined) {
        field = fieldOptions[aliasName].value;
      }
    } else {
      field = this.getFieldOrTagValue(column.field);
    }

    // If our current field, or columnParameter is a virtual tag, add it to the option list.
    fieldOptions = this.appendFieldIfUnknown(fieldOptions, field);
    fieldOptions = this.appendFieldIfUnknown(fieldOptions, fieldParameter);

    if (
      field &&
      field.kind === FieldValueKind.FUNCTION &&
      field.meta.parameters.length > 0
    ) {
      const parameters = field.meta.parameters;
      fieldParameterOptions = Object.values(fieldOptions).filter(
        ({value}) =>
          (value.kind === FieldValueKind.FIELD || value.kind === FieldValueKind.TAG) &&
          parameters[0].columnTypes.includes(value.meta.dataType)
      );
    }

    return {field, fieldOptions, fieldParameter, fieldParameterOptions};
  }

  appendFieldIfUnknown(
    fieldOptions: FieldOptions,
    field: FieldValue | null
  ): FieldOptions {
    if (!field) {
      return fieldOptions;
    }

    if (field && field.kind === FieldValueKind.TAG && field.meta.unknown) {
      // Clone the options so we don't mutate other rows.
      fieldOptions = Object.assign({}, fieldOptions);
      fieldOptions[field.meta.name] = {label: field.meta.name, value: field};
    }

    return fieldOptions;
  }

  render() {
    const {className} = this.props;
    const {
      field,
      fieldOptions,
      fieldParameter,
      fieldParameterOptions,
    } = this.getFieldData();

    return (
      <Container className={className}>
        <SelectControl
          name="field"
          options={Object.values(fieldOptions)}
          components={{
            Option: ({label, value, ...props}) => (
              <components.Option label={label} {...props}>
                <Label>
                  {label}
                  {value.kind === FieldValueKind.TAG && <Badge text="tag" />}
                </Label>
              </components.Option>
            ),
          }}
          placeholder={t('Select (Required)')}
          value={field}
          onChange={this.handleFieldChange}
        />
        {fieldParameterOptions.length === 0 ? (
          <SelectControl name="parameter" options={NO_OPTIONS} value="" isDisabled />
        ) : (
          <SelectControl
            name="parameter"
            placeholder={t('Select (Required)')}
            options={fieldParameterOptions}
            value={fieldParameter}
            onChange={this.handleFieldParameterChange}
          />
        )}
      </Container>
    );
  }
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-column-gap: ${space(1)};
  align-items: center;

  flex-grow: 1;
`;

const Label = styled('span')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

export {ColumnEditRow};
