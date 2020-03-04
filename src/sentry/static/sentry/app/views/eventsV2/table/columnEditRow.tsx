import React from 'react';
import styled from '@emotion/styled';
import {components} from 'react-select';

import Badge from 'app/components/badge';
import SelectControl from 'app/components/forms/selectControl';
import Input from 'app/components/forms/input';
import {SelectValue, StringMap} from 'app/types';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {FieldValueKind, FieldValue} from './types';
import {FIELD_ALIASES, ColumnType, AggregateParameter} from '../eventQueryParams';
import {Column} from '../eventView';

type FieldOptions = StringMap<SelectValue<FieldValue>>;

// Intermediate type that combines the current column
// data with the AggregateParameter type.
type ParameterDescription =
  | {
      kind: 'value';
      value: string;
      dataType: ColumnType;
      required: boolean;
    }
  | {
      kind: 'column';
      value: FieldValue | null;
      options: SelectValue<FieldValue>[];
      required: boolean;
    };

type Props = {
  className?: string;
  parentIndex: number;
  column: Column;
  gridColumns: number;
  fieldOptions: FieldOptions;
  onChange: (index: number, column: Column) => void;
};

class ColumnEditRow extends React.Component<Props> {
  handleFieldChange = ({value}) => {
    const {column} = this.props;
    let currentParams: [string, string, string | undefined] = [
      column.aggregation,
      column.field,
      column.refinement,
    ];

    switch (value.kind) {
      case FieldValueKind.TAG:
      case FieldValueKind.FIELD:
        currentParams = ['', value.meta.name, ''];
        break;
      case FieldValueKind.FUNCTION:
        currentParams[0] = value.meta.name;
        // Backwards compatibility for field alias versions of functions.
        if (currentParams[1] && FIELD_ALIASES.includes(currentParams[1])) {
          currentParams = [currentParams[0], '', ''];
        }
        break;
      default:
        throw new Error('Invalid field type found in column picker');
    }

    if (value.kind === FieldValueKind.FUNCTION) {
      value.meta.parameters.forEach((param: AggregateParameter, i: number) => {
        if (param.kind === 'column') {
          const field = this.getFieldOrTagValue(currentParams[i + 1]);
          if (field === null) {
            currentParams[i + 1] = param.defaultValue || '';
          } else if (
            (field.kind === FieldValueKind.FIELD || field.kind === FieldValueKind.TAG) &&
            param.columnTypes.includes(field.meta.dataType)
          ) {
            // New function accepts current field.
            currentParams[i + 1] = field.meta.name;
          } else {
            // field does not fit within new function requirements, use the default.
            currentParams[i + 1] = param.defaultValue || '';
            currentParams[i + 2] = '';
          }
        }
        if (param.kind === 'value') {
          currentParams[i + 1] = param.defaultValue;
        }
      });

      if (value.meta.parameters.length === 0) {
        currentParams = [currentParams[0], '', undefined];
      }
    }

    this.triggerChange(...currentParams);
  };

  handleFieldParameterChange = ({value}) => {
    const {column} = this.props;
    this.triggerChange(column.aggregation, value.meta.name, column.refinement);
  };

  handleRefinementChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const {column} = this.props;
    this.triggerChange(column.aggregation, column.field, event.target.value);
  };

  triggerChange(aggregation: string, field: string, refinement?: string) {
    const {parentIndex} = this.props;
    this.props.onChange(parentIndex, {
      aggregation,
      field,
      refinement,
    });
  }

  getFieldOrTagValue(name: string | undefined): FieldValue | null {
    const {fieldOptions} = this.props;
    if (name === undefined) {
      return null;
    }

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
      fieldParameter: FieldValue | null = null;

    const {column} = this.props;
    let {fieldOptions} = this.props;
    const funcName = `function:${column.aggregation}`;

    if (fieldOptions[funcName] !== undefined) {
      field = fieldOptions[funcName].value;
      // TODO move this closer to where it is used.
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

    let parameterDescriptions: ParameterDescription[] = [];
    // Generate options and values for each parameter.
    if (
      field &&
      field.kind === FieldValueKind.FUNCTION &&
      field.meta.parameters.length > 0
    ) {
      parameterDescriptions = field.meta.parameters.map(
        (param): ParameterDescription => {
          if (param.kind === 'column') {
            return {
              kind: 'column',
              value: fieldParameter,
              required: param.required,
              options: Object.values(fieldOptions).filter(
                ({value}) =>
                  (value.kind === FieldValueKind.FIELD ||
                    value.kind === FieldValueKind.TAG) &&
                  param.columnTypes.includes(value.meta.dataType)
              ),
            };
          }
          return {
            kind: 'value',
            value: column.refinement || param.defaultValue || '',
            dataType: param.dataType,
            required: param.required,
          };
        }
      );
    }

    return {field, fieldOptions, parameterDescriptions};
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

  renderParameterInputs(parameters: ParameterDescription[]): React.ReactNode[] {
    const {gridColumns} = this.props;
    const inputs = parameters.map((descriptor: any) => {
      if (descriptor.kind === 'column' && descriptor.options.length > 0) {
        return (
          <SelectControl
            key="select"
            name="parameter"
            placeholder={t('Select value')}
            options={descriptor.options}
            value={descriptor.value}
            required={descriptor.required}
            onChange={this.handleFieldParameterChange}
          />
        );
      }
      if (descriptor.kind === 'value') {
        const inputProps = {
          required: descriptor.required,
          value: descriptor.value,
          onChange: this.handleRefinementChange,
        };
        switch (descriptor.dataType) {
          case 'number':
            return (
              <StyledInput
                name="refinement"
                key="parameter:number"
                type="number"
                min="0"
                step="0.01"
                {...inputProps}
              />
            );
          case 'integer':
            return (
              <StyledInput
                name="refinement"
                key="parameter:integer"
                type="number"
                min="0"
                step="1"
                {...inputProps}
              />
            );
          default:
            return (
              <StyledInput
                name="refinement"
                key="parameter:text"
                type="text"
                {...inputProps}
              />
            );
        }
      }
      throw new Error(`Unknown parameter type encountered for ${this.props.column}`);
    });

    // Add enough disabled inputs to fill the grid up.
    // We always have 1 input.
    const requiredInputs = gridColumns - inputs.length - 1;
    if (requiredInputs > 0) {
      for (let i = 0; i < requiredInputs; i++) {
        inputs.push(
          <StyledInput key={`disabled:${i}`} placeholder={t('N/A')} disabled />
        );
      }
    }

    return inputs;
  }

  render() {
    const {className, gridColumns} = this.props;
    const {field, fieldOptions, parameterDescriptions} = this.getFieldData();

    const parameterInputs = this.renderParameterInputs(parameterDescriptions);
    return (
      <Container className={className} gridColumns={gridColumns}>
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
          placeholder={t('(Required)')}
          value={field}
          onChange={this.handleFieldChange}
        />
        {parameterInputs}
      </Container>
    );
  }
}

const Container = styled('div')<{gridColumns: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.gridColumns}, 1fr);
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

// Set a min-width to allow shrinkage in grid.
const StyledInput = styled(Input)`
  min-width: 50px;
`;

export {ColumnEditRow};
