import {CSSProperties} from 'react';
import * as React from 'react';
import {components, OptionProps, SingleValueProps} from 'react-select';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import SelectControl, {ControlProps} from 'app/components/forms/selectControl';
import Tag from 'app/components/tag';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {SelectValue} from 'app/types';
import {
  AggregateParameter,
  AggregationKey,
  Column,
  ColumnType,
  QueryFieldValue,
  ValidateColumnTypes,
} from 'app/utils/discover/fields';
import Input from 'app/views/settings/components/forms/controls/input';

import ArithmeticInput from './arithmeticInput';
import {FieldValue, FieldValueColumns, FieldValueKind} from './types';

type FieldValueOption = SelectValue<FieldValue>;

type FieldOptions = Record<string, FieldValueOption>;

// Intermediate type that combines the current column
// data with the AggregateParameter type.
type ParameterDescription =
  | {
      kind: 'value';
      value: string;
      dataType: ColumnType;
      required: boolean;
      placeholder?: string;
    }
  | {
      kind: 'column';
      value: FieldValue | null;
      options: FieldValueOption[];
      required: boolean;
    }
  | {
      kind: 'dropdown';
      value: string;
      options: SelectValue<string>[];
      dataType: string;
      required: boolean;
      placeholder?: string;
    };

type Props = {
  className?: string;
  takeFocus?: boolean;
  fieldValue: QueryFieldValue;
  fieldOptions: FieldOptions;
  /**
   * The number of columns to render. Columns that do not have a parameter will
   * render an empty parameter placeholder. Leave blank to avoid adding spacers.
   */
  gridColumns?: number;
  /**
   * Filter the options in the primary selector. Useful if you only want to
   * show a subset of selectable items.
   *
   * NOTE: This is different from passing an already filtered fieldOptions
   * list, as tag items in the list may be used as parameters to functions.
   */
  filterPrimaryOptions?: (option: FieldValueOption) => boolean;
  /**
   * Function to filter the options that are used as parameters for function/aggregate.
   */
  filterAggregateParameters?: (option: FieldValueOption) => boolean;
  /**
   * Whether or not to add labels inside of the input fields, currently only
   * used for the metric alert builder.
   */
  inFieldLabels?: boolean;
  /**
   * Whether or not to add the tag explaining the FieldValueKind of each field
   */
  shouldRenderTag?: boolean;
  onChange: (fieldValue: QueryFieldValue) => void;
  disabled?: boolean;
  hidePrimarySelector?: boolean;
  hideParameterSelector?: boolean;
  otherColumns?: Column[];
};

// Type for completing generics in react-select
type OptionType = {
  label: string;
  value: FieldValue;
};

class QueryField extends React.Component<Props> {
  FieldSelectComponents = {
    Option: ({label, data, ...props}: OptionProps<OptionType>) => (
      <components.Option label={label} data={data} {...props}>
        <span data-test-id="label">{label}</span>
        {this.renderTag(data.value.kind)}
      </components.Option>
    ),
    SingleValue: ({data, ...props}: SingleValueProps<OptionType>) => (
      <components.SingleValue data={data} {...props}>
        <span data-test-id="label">{data.label}</span>
        {this.renderTag(data.value.kind)}
      </components.SingleValue>
    ),
  };

  FieldSelectStyles = {
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

  handleFieldChange = (selected?: FieldValueOption | null) => {
    if (!selected) {
      return;
    }
    const {value} = selected;
    const current = this.props.fieldValue;
    let fieldValue: QueryFieldValue = cloneDeep(this.props.fieldValue);

    switch (value.kind) {
      case FieldValueKind.TAG:
      case FieldValueKind.MEASUREMENT:
      case FieldValueKind.BREAKDOWN:
      case FieldValueKind.FIELD:
        fieldValue = {kind: 'field', field: value.meta.name};
        break;
      case FieldValueKind.FUNCTION:
        if (current.kind === 'field') {
          fieldValue = {
            kind: 'function',
            function: [value.meta.name as AggregationKey, '', undefined, undefined],
          };
        } else if (current.kind === 'function') {
          fieldValue = {
            kind: 'function',
            function: [
              value.meta.name as AggregationKey,
              current.function[1],
              current.function[2],
              current.function[3],
            ],
          };
        }
        break;
      default:
        throw new Error('Invalid field type found in column picker');
    }

    if (value.kind === FieldValueKind.FUNCTION) {
      value.meta.parameters.forEach((param: AggregateParameter, i: number) => {
        if (fieldValue.kind !== 'function') {
          return;
        }
        if (param.kind === 'column') {
          const field = this.getFieldOrTagOrMeasurementValue(fieldValue.function[i + 1]);
          if (field === null) {
            fieldValue.function[i + 1] = param.defaultValue || '';
          } else if (
            (field.kind === FieldValueKind.FIELD ||
              field.kind === FieldValueKind.TAG ||
              field.kind === FieldValueKind.MEASUREMENT ||
              field.kind === FieldValueKind.BREAKDOWN) &&
            validateColumnTypes(param.columnTypes as ValidateColumnTypes, field)
          ) {
            // New function accepts current field.
            fieldValue.function[i + 1] = field.meta.name;
          } else {
            // field does not fit within new function requirements, use the default.
            fieldValue.function[i + 1] = param.defaultValue || '';
            fieldValue.function[i + 2] = undefined;
            fieldValue.function[i + 3] = undefined;
          }
        } else {
          fieldValue.function[i + 1] = param.defaultValue || '';
        }
      });

      if (fieldValue.kind === 'function') {
        if (value.meta.parameters.length === 0) {
          fieldValue.function = [fieldValue.function[0], '', undefined, undefined];
        } else if (value.meta.parameters.length === 1) {
          fieldValue.function[2] = undefined;
          fieldValue.function[3] = undefined;
        } else if (value.meta.parameters.length === 2) {
          fieldValue.function[3] = undefined;
        }
      }
    }

    this.triggerChange(fieldValue);
  };

  handleEquationChange = (value: string) => {
    const newColumn = cloneDeep(this.props.fieldValue);
    if (newColumn.kind === FieldValueKind.EQUATION) {
      newColumn.field = value;
    }
    this.triggerChange(newColumn);
  };

  handleFieldParameterChange = ({value}) => {
    const newColumn = cloneDeep(this.props.fieldValue);
    if (newColumn.kind === 'function') {
      newColumn.function[1] = value.meta.name;
    }
    this.triggerChange(newColumn);
  };

  handleDropdownParameterChange = (index: number) => {
    return (value: SelectValue<string>) => {
      const newColumn = cloneDeep(this.props.fieldValue);
      if (newColumn.kind === 'function') {
        newColumn.function[index] = value.value;
      }
      this.triggerChange(newColumn);
    };
  };

  handleScalarParameterChange = (index: number) => {
    return (value: string) => {
      const newColumn = cloneDeep(this.props.fieldValue);
      if (newColumn.kind === 'function') {
        newColumn.function[index] = value;
      }
      this.triggerChange(newColumn);
    };
  };

  triggerChange(fieldValue: QueryFieldValue) {
    this.props.onChange(fieldValue);
  }

  getFieldOrTagOrMeasurementValue(name: string | undefined): FieldValue | null {
    const {fieldOptions} = this.props;
    if (name === undefined) {
      return null;
    }

    const fieldName = `field:${name}`;
    if (fieldOptions[fieldName]) {
      return fieldOptions[fieldName].value;
    }

    const measurementName = `measurement:${name}`;
    if (fieldOptions[measurementName]) {
      return fieldOptions[measurementName].value;
    }

    const spanOperationBreakdownName = `span_op_breakdown:${name}`;
    if (fieldOptions[spanOperationBreakdownName]) {
      return fieldOptions[spanOperationBreakdownName].value;
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
    let field: FieldValue | null = null;

    const {fieldValue} = this.props;
    let {fieldOptions} = this.props;

    if (fieldValue.kind === 'function') {
      const funcName = `function:${fieldValue.function[0]}`;
      if (fieldOptions[funcName] !== undefined) {
        field = fieldOptions[funcName].value;
      }
    }

    if (fieldValue.kind === 'field') {
      field = this.getFieldOrTagOrMeasurementValue(fieldValue.field);
      fieldOptions = this.appendFieldIfUnknown(fieldOptions, field);
    }

    let parameterDescriptions: ParameterDescription[] = [];
    // Generate options and values for each parameter.
    if (
      field &&
      field.kind === FieldValueKind.FUNCTION &&
      field.meta.parameters.length > 0 &&
      fieldValue.kind === FieldValueKind.FUNCTION
    ) {
      parameterDescriptions = field.meta.parameters.map(
        (param, index: number): ParameterDescription => {
          if (param.kind === 'column') {
            const fieldParameter = this.getFieldOrTagOrMeasurementValue(
              fieldValue.function[1]
            );
            fieldOptions = this.appendFieldIfUnknown(fieldOptions, fieldParameter);
            return {
              kind: 'column',
              value: fieldParameter,
              required: param.required,
              options: Object.values(fieldOptions).filter(
                ({value}) =>
                  (value.kind === FieldValueKind.FIELD ||
                    value.kind === FieldValueKind.TAG ||
                    value.kind === FieldValueKind.MEASUREMENT ||
                    value.kind === FieldValueKind.BREAKDOWN) &&
                  validateColumnTypes(param.columnTypes as ValidateColumnTypes, value)
              ),
            };
          } else if (param.kind === 'dropdown') {
            return {
              kind: 'dropdown',
              options: param.options,
              dataType: param.dataType,
              required: param.required,
              value:
                (fieldValue.kind === 'function' && fieldValue.function[index + 1]) ||
                param.defaultValue ||
                '',
            };
          }

          return {
            kind: 'value',
            value:
              (fieldValue.kind === 'function' && fieldValue.function[index + 1]) ||
              param.defaultValue ||
              '',
            dataType: param.dataType,
            required: param.required,
            placeholder: param.placeholder,
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
    const {disabled, inFieldLabels, filterAggregateParameters, hideParameterSelector} =
      this.props;
    const inputs = parameters.map((descriptor: ParameterDescription, index: number) => {
      if (descriptor.kind === 'column' && descriptor.options.length > 0) {
        if (hideParameterSelector) {
          return null;
        }
        const aggregateParameters = filterAggregateParameters
          ? descriptor.options.filter(filterAggregateParameters)
          : descriptor.options;

        return (
          <SelectControl
            key="select"
            name="parameter"
            placeholder={t('Select value')}
            options={aggregateParameters}
            value={descriptor.value}
            required={descriptor.required}
            onChange={this.handleFieldParameterChange}
            inFieldLabel={inFieldLabels ? t('Parameter: ') : undefined}
            disabled={disabled}
            styles={!inFieldLabels ? this.FieldSelectStyles : undefined}
            components={this.FieldSelectComponents}
          />
        );
      }
      if (descriptor.kind === 'value') {
        const inputProps = {
          required: descriptor.required,
          value: descriptor.value,
          onUpdate: this.handleScalarParameterChange(index + 1),
          placeholder: descriptor.placeholder,
          disabled,
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
      if (descriptor.kind === 'dropdown') {
        return (
          <SelectControl
            key="dropdown"
            name="dropdown"
            placeholder={t('Select value')}
            options={descriptor.options}
            value={descriptor.value}
            required={descriptor.required}
            onChange={this.handleDropdownParameterChange(index + 1)}
            inFieldLabel={inFieldLabels ? t('Parameter: ') : undefined}
            disabled={disabled}
          />
        );
      }
      throw new Error(`Unknown parameter type encountered for ${this.props.fieldValue}`);
    });

    // Add enough disabled inputs to fill the grid up.
    // We always have 1 input.
    const {gridColumns} = this.props;
    const requiredInputs = (gridColumns ?? inputs.length + 1) - inputs.length - 1;
    if (gridColumns !== undefined && requiredInputs > 0) {
      for (let i = 0; i < requiredInputs; i++) {
        inputs.push(<BlankSpace key={i} />);
      }
    }

    return inputs;
  }

  renderTag(kind) {
    const {shouldRenderTag} = this.props;
    if (shouldRenderTag === false) {
      return null;
    }
    let text, tagType;
    switch (kind) {
      case FieldValueKind.FUNCTION:
        text = 'f(x)';
        tagType = 'success';
        break;
      case FieldValueKind.MEASUREMENT:
        text = 'measure';
        tagType = 'info';
        break;
      case FieldValueKind.BREAKDOWN:
        text = 'breakdown';
        tagType = 'error';
        break;
      case FieldValueKind.TAG:
        text = kind;
        tagType = 'warning';
        break;
      case FieldValueKind.FIELD:
        text = kind;
        tagType = 'highlight';
        break;
      default:
        text = kind;
    }
    return <Tag type={tagType}>{text}</Tag>;
  }

  render() {
    const {
      className,
      takeFocus,
      filterPrimaryOptions,
      fieldValue,
      inFieldLabels,
      disabled,
      hidePrimarySelector,
      gridColumns,
      otherColumns,
    } = this.props;
    const {field, fieldOptions, parameterDescriptions} = this.getFieldData();

    const allFieldOptions = filterPrimaryOptions
      ? Object.values(fieldOptions).filter(filterPrimaryOptions)
      : Object.values(fieldOptions);

    const selectProps: ControlProps<FieldValueOption> = {
      name: 'field',
      options: Object.values(allFieldOptions),
      placeholder: t('(Required)'),
      value: field,
      onChange: this.handleFieldChange,
      inFieldLabel: inFieldLabels ? t('Function: ') : undefined,
      disabled,
    };
    if (takeFocus && field === null) {
      selectProps.autoFocus = true;
    }

    const parameters = this.renderParameterInputs(parameterDescriptions);

    if (fieldValue.kind === FieldValueKind.EQUATION) {
      return (
        <Container className={className} gridColumns={1} tripleLayout={false}>
          <ArithmeticInput
            name="arithmetic"
            key="parameter:text"
            type="text"
            required
            value={fieldValue.field}
            onUpdate={this.handleEquationChange}
            options={otherColumns}
          />
        </Container>
      );
    }

    // if there's more than 2 parameters, set gridColumns to 2 so they go onto the next line instead
    const containerColumns =
      parameters.length > 2 ? 2 : gridColumns ? gridColumns : parameters.length + 1;
    return (
      <Container
        className={className}
        gridColumns={containerColumns}
        tripleLayout={gridColumns === 3 && parameters.length > 2}
      >
        {!hidePrimarySelector && (
          <SelectControl
            {...selectProps}
            styles={!inFieldLabels ? this.FieldSelectStyles : undefined}
            components={this.FieldSelectComponents}
          />
        )}
        {parameters}
      </Container>
    );
  }
}

function validateColumnTypes(
  columnTypes: ValidateColumnTypes,
  input: FieldValueColumns
): boolean {
  if (typeof columnTypes === 'function') {
    return columnTypes({name: input.meta.name, dataType: input.meta.dataType});
  }

  return columnTypes.includes(input.meta.dataType);
}

const Container = styled('div')<{gridColumns: number; tripleLayout: boolean}>`
  display: grid;
  ${p =>
    p.tripleLayout
      ? `grid-template-columns: 1fr 2fr;`
      : `grid-template-columns: repeat(${p.gridColumns}, 1fr);`}
  grid-gap: ${space(1)};
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
 * we can't update the QueryField that often as it would re-render
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

  state: InputState = {
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
const StyledInput = styled(Input)`
  /* Match the height of the select boxes */
  height: 41px;
  min-width: 50px;
`;

const BlankSpace = styled('div')`
  /* Match the height of the select boxes */
  height: 41px;
  min-width: 50px;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;

  &:after {
    font-size: ${p => p.theme.fontSizeMedium};
    content: '${t('No parameter')}';
    color: ${p => p.theme.gray300};
  }
`;

export {QueryField};
