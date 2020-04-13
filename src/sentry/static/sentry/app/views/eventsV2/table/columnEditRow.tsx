import React, {CSSProperties} from 'react';
import styled from '@emotion/styled';
// eslint import checks can't find types in the flow code.
// eslint-disable-next-line import/named
import {components, SingleValueProps, OptionProps} from 'react-select';
import cloneDeep from 'lodash/cloneDeep';

import Badge from 'app/components/badge';
import SelectControl from 'app/components/forms/selectControl';
import {SelectValue} from 'app/types';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Column, ColumnType, AggregateParameter} from 'app/utils/discover/fields';

import {FieldValueKind, FieldValue} from './types';

type FieldOptions = Record<string, SelectValue<FieldValue>>;

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
  takeFocus: boolean;
  parentIndex: number;
  column: Column;
  gridColumns: number;
  fieldOptions: FieldOptions;
  onChange: (index: number, column: Column) => void;
};

// Type for completing generics in react-select
type OptionType = {
  label: string;
  value: FieldValue;
};

class ColumnEditRow extends React.Component<Props> {
  handleFieldChange = ({value}) => {
    const current = this.props.column;
    let column: Column = cloneDeep(this.props.column);

    switch (value.kind) {
      case FieldValueKind.TAG:
      case FieldValueKind.FIELD:
        column = {kind: 'field', field: value.meta.name};
        break;
      case FieldValueKind.FUNCTION:
        if (current.kind === 'field') {
          column = {kind: 'function', function: [value.meta.name, '', undefined]};
        } else if (current.kind === 'function') {
          column = {
            kind: 'function',
            function: [value.meta.name, current.function[1], current.function[2]],
          };
        }
        break;
      default:
        throw new Error('Invalid field type found in column picker');
    }

    if (value.kind === FieldValueKind.FUNCTION) {
      value.meta.parameters.forEach((param: AggregateParameter, i: number) => {
        if (column.kind !== 'function') {
          return;
        }
        if (param.kind === 'column') {
          const field = this.getFieldOrTagValue(column.function[i + 1]);
          if (field === null) {
            column.function[i + 1] = param.defaultValue || '';
          } else if (
            (field.kind === FieldValueKind.FIELD || field.kind === FieldValueKind.TAG) &&
            param.columnTypes.includes(field.meta.dataType)
          ) {
            // New function accepts current field.
            column.function[i + 1] = field.meta.name;
          } else {
            // field does not fit within new function requirements, use the default.
            column.function[i + 1] = param.defaultValue || '';
            column.function[i + 2] = undefined;
          }
        }
        if (param.kind === 'value') {
          column.function[i + 1] = param.defaultValue || '';
        }
      });

      if (column.kind === 'function' && value.meta.parameters.length === 0) {
        column.function = [column.function[0], '', undefined];
      }
    }

    this.triggerChange(column);
  };

  handleFieldParameterChange = ({value}) => {
    const newColumn = cloneDeep(this.props.column);
    if (newColumn.kind === 'function') {
      newColumn.function[1] = value.meta.name;
    }
    this.triggerChange(newColumn);
  };

  handleRefinementChange = (value: string) => {
    const newColumn = cloneDeep(this.props.column);
    if (newColumn.kind === 'function') {
      newColumn.function[2] = value;
    }
    this.triggerChange(newColumn);
  };

  triggerChange(column: Column) {
    const {parentIndex} = this.props;
    this.props.onChange(parentIndex, column);
  }

  getFieldOrTagValue(name: string | undefined): FieldValue | null {
    const {fieldOptions} = this.props;
    if (name === undefined) {
      return null;
    }

    const fieldName = `field:${name}`;
    if (fieldOptions[fieldName]) {
      return fieldOptions[fieldName].value;
    }
    const tagName =
      name.indexOf('tags[') === 0
        ? `tag:${name.replace(/tags\[(.*?)\]/, '$1')}`
        : `tag:${name}`;

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

    if (column.kind === 'function') {
      const funcName = `function:${column.function[0]}`;
      if (fieldOptions[funcName] !== undefined) {
        field = fieldOptions[funcName].value;
        // TODO move this closer to where it is used.
        fieldParameter = this.getFieldOrTagValue(column.function[1]);
      }
    }
    if (column.kind === 'field') {
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
            value:
              (column.kind === 'function' && column.function[2]) ||
              param.defaultValue ||
              '',
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
    const inputs = parameters.map((descriptor: ParameterDescription) => {
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
          onUpdate: this.handleRefinementChange,
        };
        switch (descriptor.dataType) {
          case 'number':
            return (
              <BufferedInput
                name="refinement"
                key="parameter:number"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*(\.[0-9]*)?"
                {...inputProps}
              />
            );
          case 'integer':
            return (
              <BufferedInput
                name="refinement"
                key="parameter:integer"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                {...inputProps}
              />
            );
          default:
            return (
              <BufferedInput
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
          <StyledInput
            className="form-control"
            key={`disabled:${i}`}
            placeholder={t('N/A')}
            disabled
          />
        );
      }
    }

    return inputs;
  }

  render() {
    const {className, takeFocus, gridColumns} = this.props;
    const {field, fieldOptions, parameterDescriptions} = this.getFieldData();

    const selectProps: React.ComponentProps<SelectControl> = {
      name: 'field',
      options: Object.values(fieldOptions),
      placeholder: t('(Required)'),
      value: field,
      onChange: this.handleFieldChange,
    };
    if (takeFocus && field === null) {
      selectProps.autoFocus = true;
    }

    const styles = {
      singleValue(provided: CSSProperties) {
        const custom = {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'calc(100% - 10px)',
        };
        return {...provided, ...custom};
      },
      option(provided: CSSProperties) {
        const custom = {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        };
        return {...provided, ...custom};
      },
    };

    return (
      <Container className={className} gridColumns={gridColumns}>
        <SelectControl
          {...selectProps}
          styles={styles}
          components={{
            Option: ({label, data, ...props}: OptionProps<OptionType>) => (
              <components.Option label={label} {...(props as any)}>
                <span data-test-id="label">{label}</span>
                {data.value.kind === FieldValueKind.TAG && <Badge text="tag" />}
              </components.Option>
            ),
            SingleValue: ({data, ...props}: SingleValueProps<OptionType>) => (
              <components.SingleValue data={data} {...(props as any)}>
                <span data-test-id="label">{data.label}</span>
                {data.value.kind === FieldValueKind.TAG && <Badge text="tag" />}
              </components.SingleValue>
            ),
          }}
        />
        {this.renderParameterInputs(parameterDescriptions)}
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

type InputProps = React.HTMLProps<HTMLInputElement> & {
  onUpdate: (value: string) => void;
  value: string;
};
type InputState = {value: string};

/**
 * Because controlled inputs fire onChange on every key stroke,
 * we can't update the ColumnEditRow that often as it would re-render
 * the input elements causing focus to be lost.
 *
 * Using a buffered input lets us throttle rendering and enforce data
 * constraints better.
 */
class BufferedInput extends React.Component<InputProps, InputState> {
  constructor(props: InputProps) {
    super(props);
    this.input = React.createRef();
  }

  state = {
    value: this.props.value,
  };

  private input: React.RefObject<HTMLInputElement>;

  get isValid() {
    if (!this.input.current) {
      return true;
    }
    return this.input.current.validity.valid;
  }

  handleBlur = () => {
    if (this.isValid) {
      this.props.onUpdate(this.state.value);
    } else {
      this.setState({value: this.props.value});
    }
  };

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (this.isValid) {
      this.setState({value: event.target.value});
    }
  };

  render() {
    const {onUpdate: _, ...props} = this.props;
    return (
      <StyledInput
        {...props}
        ref={this.input}
        className="form-control"
        value={this.state.value}
        onChange={this.handleChange}
        onBlur={this.handleBlur}
      />
    );
  }
}

// Set a min-width to allow shrinkage in grid.
const StyledInput = styled('input')`
  min-width: 50px;
  /* Match the height of the select boxes */
  height: 37px;

  &:not([disabled='true']):invalid {
    border-color: ${p => p.theme.red};
  }
`;

export {ColumnEditRow};
