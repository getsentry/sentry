import React from 'react';
import styled from '@emotion/styled';
import {components} from 'react-select';

import Badge from 'app/components/badge';
import SelectControl from 'app/components/forms/selectControl';
import {SelectValue} from 'app/types';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {ColumnType, AggregateParameter} from '../eventQueryParams';
import {Column} from '../eventView';

export enum FieldValueKind {
  TAG = 'tag',
  FIELD = 'field',
  FUNCTION = 'function',
}

// Payload of select options used to update column
// data as the first picker has tags, fields and functions all combined.
export type FieldValue =
  | {
      kind: FieldValueKind.TAG;
      meta: {
        name: string;
        dataType: ColumnType;
      };
    }
  | {
      kind: FieldValueKind.FIELD;
      meta: {
        name: string;
        dataType: ColumnType;
      };
    }
  | {
      kind: FieldValueKind.FUNCTION;
      meta: {
        name: string;
        parameters: AggregateParameter[];
      };
    };

type Props = {
  className?: string;
  parentIndex: number;
  column: Column;
  fieldOptions: {[key: string]: SelectValue<FieldValue>};
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
        break;
      default:
        throw new Error('Invald field type found in column picker');
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
    return (fieldOptions[`field:${name}`] || fieldOptions[`tag:${name}`] || {value: null})
      .value;
  }

  getFieldParameterData() {
    let field: FieldValue | null = null,
      fieldParameter: FieldValue | null = null,
      fieldParameterOptions: SelectValue<FieldValue>[] = [];

    const {column, fieldOptions} = this.props;
    const funcName = `function:${column.aggregation}`;

    if (column.aggregation && fieldOptions[funcName] !== undefined) {
      field = fieldOptions[funcName].value;
      fieldParameter = this.getFieldOrTagValue(column.field);
    } else {
      field = this.getFieldOrTagValue(column.field);
    }

    if (
      field &&
      field.kind === FieldValueKind.FUNCTION &&
      field.meta.parameters.length > 0
    ) {
      const parameters = field.meta.parameters;
      fieldParameterOptions = Object.values(fieldOptions).filter(
        item =>
          item.value.kind === FieldValueKind.FIELD &&
          parameters[0].columnTypes.includes(item.value.meta.dataType)
      );
    }

    return {field, fieldParameter, fieldParameterOptions};
  }

  render() {
    // TODO add additional parameter for tracing functions
    const {className, fieldOptions} = this.props;
    const {field, fieldParameter, fieldParameterOptions} = this.getFieldParameterData();

    return (
      <Container className={className}>
        <SelectControl
          options={Object.values(fieldOptions)}
          components={{
            Option: ({label, value, ...props}) => (
              <components.Option {...props}>
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
          <SelectControl options={NO_OPTIONS} value="" isDisabled />
        ) : (
          <SelectControl
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
