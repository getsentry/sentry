import {Component, createRef} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import Tag from 'sentry/components/badge/tag';
import type {InputProps} from 'sentry/components/core/input';
import {Input} from 'sentry/components/core/input';
import type {SingleValueProps} from 'sentry/components/forms/controls/reactSelectWrapper';
import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {ControlProps} from 'sentry/components/forms/controls/selectControl';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {pulse} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {
  AggregateParameter,
  AggregationKeyWithAlias,
  Column,
  ColumnType,
  QueryFieldValue,
  ValidateColumnTypes,
} from 'sentry/utils/discover/fields';
import {AGGREGATIONS, DEPRECATED_FIELDS} from 'sentry/utils/discover/fields';
import {SESSIONS_OPERATIONS} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';

import ArithmeticInput from './arithmeticInput';
import type {FieldValue, FieldValueColumns} from './types';
import {FieldValueKind} from './types';

export type FieldValueOption = SelectValue<FieldValue>;

type FieldOptions = Record<string, FieldValueOption>;

// Intermediate type that combines the current column
// data with the AggregateParameter type.
export type ParameterDescription =
  | {
      dataType: ColumnType;
      kind: 'value';
      required: boolean;
      value: string;
      placeholder?: string;
    }
  | {
      kind: 'column';
      options: FieldValueOption[];
      required: boolean;
      value: FieldValue | null;
    }
  | {
      dataType: string;
      kind: 'dropdown';
      options: Array<SelectValue<string>>;
      required: boolean;
      value: string;
      placeholder?: string;
    };

type Props = {
  fieldOptions: FieldOptions;
  fieldValue: QueryFieldValue;
  onChange: (fieldValue: QueryFieldValue) => void;
  className?: string;
  disabled?: boolean;
  error?: string;
  /**
   * Function to filter the options that are used as parameters for function/aggregate.
   */
  filterAggregateParameters?: (
    option: FieldValueOption,
    fieldValue?: QueryFieldValue
  ) => boolean;
  /**
   * Filter the options in the primary selector. Useful if you only want to
   * show a subset of selectable items.
   *
   * NOTE: This is different from passing an already filtered fieldOptions
   * list, as tag items in the list may be used as parameters to functions.
   */
  filterPrimaryOptions?: (option: FieldValueOption) => boolean;
  /**
   * The number of columns to render. Columns that do not have a parameter will
   * render an empty parameter placeholder. Leave blank to avoid adding spacers.
   */
  gridColumns?: number;
  hideParameterSelector?: boolean;
  hidePrimarySelector?: boolean;
  /**
   * Whether or not to add labels inside of the input fields, currently only
   * used for the metric alert builder.
   */
  inFieldLabels?: boolean;
  /**
   * This will be displayed in the select if there are no fields
   */
  noFieldsMessage?: string;
  otherColumns?: Column[];
  placeholder?: string;
  /**
   * Whether or not to add the tag explaining the FieldValueKind of each field
   */
  shouldRenderTag?: boolean;
  skipParameterPlaceholder?: boolean;
  takeFocus?: boolean;
};

// Type for completing generics in react-select
type OptionType = {
  label: string;
  value: FieldValue;
};

class QueryField extends Component<Props> {
  FieldSelectComponents = {
    SingleValue: ({data, ...props}: SingleValueProps<OptionType>) => {
      return (
        <components.SingleValue data={data} {...props}>
          <span data-test-id="label">{data.label}</span>
          {data.value && this.renderTag(data.value.kind, data.label)}
        </components.SingleValue>
      );
    },
  };

  FieldSelectStyles = {
    singleValue(provided: React.CSSProperties) {
      const custom = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
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
      case FieldValueKind.CUSTOM_MEASUREMENT:
      case FieldValueKind.BREAKDOWN:
      case FieldValueKind.FIELD:
        fieldValue = {kind: 'field', field: value.meta.name};
        break;
      case FieldValueKind.NUMERIC_METRICS:
        fieldValue = {
          kind: 'calculatedField',
          field: value.meta.name,
        };
        break;
      case FieldValueKind.FUNCTION:
        if (current.kind === 'function') {
          fieldValue = {
            kind: 'function',
            function: [
              value.meta.name as AggregationKeyWithAlias,
              current.function[1],
              current.function[2],
              current.function[3],
            ],
          };
        } else {
          fieldValue = {
            kind: 'function',
            function: [
              value.meta.name as AggregationKeyWithAlias,
              '',
              undefined,
              undefined,
            ],
          };
        }
        break;
      case FieldValueKind.EQUATION:
        fieldValue = {
          kind: 'equation',
          field: value.meta.name,
          alias: value.meta.name,
        };
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
              field.kind === FieldValueKind.CUSTOM_MEASUREMENT ||
              field.kind === FieldValueKind.METRICS ||
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

  handleFieldParameterChange = ({value}: any) => {
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

  getFieldOrTagOrMeasurementValue(
    name: string | undefined,
    functions: string[] = []
  ): FieldValue | null {
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

    const equationName = `equation:${name}`;
    if (fieldOptions[equationName]) {
      return fieldOptions[equationName].value;
    }

    const tagName =
      name.indexOf('tags[') === 0
        ? `tag:${name.replace(/tags\[(.*?)\]/, '$1')}`
        : `tag:${name}`;

    if (fieldOptions[tagName]) {
      return fieldOptions[tagName].value;
    }

    if (name.length > 0) {
      // Custom Measurement. Probably not appearing in field options because
      // no metrics found within selected time range
      if (name.startsWith('measurements.')) {
        return {
          kind: FieldValueKind.CUSTOM_MEASUREMENT,
          meta: {
            name,
            dataType: 'number',
            functions,
          },
        };
      }
      // Likely a tag that was deleted but left behind in a saved query
      // Cook up a tag option so select control works.
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

    if (fieldValue?.kind === 'function') {
      const funcName = `function:${fieldValue.function[0]}`;
      if (fieldOptions[funcName] !== undefined) {
        field = fieldOptions[funcName].value;
      }
    }

    if (fieldValue?.kind === 'field' || fieldValue?.kind === 'calculatedField') {
      field = this.getFieldOrTagOrMeasurementValue(fieldValue.field);
      fieldOptions = appendFieldIfUnknown(fieldOptions, field);
    }

    let parameterDescriptions: ParameterDescription[] = [];
    // Generate options and values for each parameter.
    if (
      field &&
      field.kind === FieldValueKind.FUNCTION &&
      field.meta.parameters.length > 0 &&
      fieldValue?.kind === FieldValueKind.FUNCTION
    ) {
      parameterDescriptions = field.meta.parameters.map(
        (param, index: number): ParameterDescription => {
          if (param.kind === 'column') {
            const fieldParameter = this.getFieldOrTagOrMeasurementValue(
              fieldValue.function[1],
              [fieldValue.function[0]]
            );
            fieldOptions = appendFieldIfUnknown(fieldOptions, fieldParameter);
            return {
              kind: 'column',
              value: fieldParameter,
              required: param.required,
              options: Object.values(fieldOptions).filter(
                ({value}) =>
                  (value.kind === FieldValueKind.FIELD ||
                    value.kind === FieldValueKind.TAG ||
                    value.kind === FieldValueKind.MEASUREMENT ||
                    value.kind === FieldValueKind.CUSTOM_MEASUREMENT ||
                    value.kind === FieldValueKind.METRICS ||
                    value.kind === FieldValueKind.BREAKDOWN) &&
                  validateColumnTypes(param.columnTypes as ValidateColumnTypes, value)
              ),
            };
          }
          if (param.kind === 'dropdown') {
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

  renderParameterInputs(parameters: ParameterDescription[]): React.ReactNode[] {
    const {
      disabled,
      inFieldLabels,
      filterAggregateParameters,
      hideParameterSelector,
      skipParameterPlaceholder,
      fieldValue,
    } = this.props;

    const inputs = parameters.map((descriptor: ParameterDescription, index: number) => {
      if (descriptor.kind === 'column' && descriptor.options.length > 0) {
        if (hideParameterSelector) {
          return null;
        }
        const aggregateParameters = filterAggregateParameters
          ? descriptor.options.filter(option =>
              filterAggregateParameters(option, fieldValue)
            )
          : descriptor.options;

        aggregateParameters.forEach(opt => {
          opt.trailingItems = this.renderTag(opt.value.kind, String(opt.label));
        });

        return (
          <SelectControl
            key="select"
            name="parameter"
            menuPlacement="auto"
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
            menuPlacement="auto"
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

    if (skipParameterPlaceholder) {
      return inputs;
    }

    // Add enough disabled inputs to fill the grid up.
    // We always have 1 input.
    const {gridColumns} = this.props;
    const requiredInputs = (gridColumns ?? inputs.length + 1) - inputs.length - 1;
    if (gridColumns !== undefined && requiredInputs > 0) {
      for (let i = 0; i < requiredInputs; i++) {
        inputs.push(<BlankSpace key={i} data-test-id="blankSpace" />);
      }
    }

    return inputs;
  }

  renderTag(kind: FieldValueKind, label: string) {
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
      case FieldValueKind.CUSTOM_MEASUREMENT:
      case FieldValueKind.MEASUREMENT:
        text = 'field';
        tagType = 'highlight';
        break;
      case FieldValueKind.BREAKDOWN:
        text = 'field';
        tagType = 'highlight';
        break;
      case FieldValueKind.TAG:
        text = kind;
        tagType = 'warning';
        break;
      case FieldValueKind.NUMERIC_METRICS:
        text = 'f(x)';
        tagType = 'success';
        break;
      case FieldValueKind.FIELD:
        text = DEPRECATED_FIELDS.includes(label) ? 'deprecated' : 'field';
        tagType = 'highlight';
        break;
      default:
        text = kind;
    }
    // @ts-expect-error TS(2322): Type 'string | undefined' is not assignable to typ... Remove this comment to see the full error message
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
      error,
      hidePrimarySelector,
      gridColumns,
      otherColumns,
      placeholder,
      noFieldsMessage,
      skipParameterPlaceholder,
    } = this.props;
    const {field, fieldOptions, parameterDescriptions} = this.getFieldData();

    const allFieldOptions = filterPrimaryOptions
      ? Object.values(fieldOptions).filter(filterPrimaryOptions)
      : Object.values(fieldOptions);

    allFieldOptions.forEach(opt => {
      opt.trailingItems = this.renderTag(opt.value.kind, String(opt.label));
    });

    const selectProps: ControlProps<FieldValueOption> = {
      name: 'field',
      options: Object.values(allFieldOptions),
      placeholder: placeholder ?? t('(Required)'),
      value: field,
      onChange: this.handleFieldChange,
      inFieldLabel: inFieldLabels ? t('Function: ') : undefined,
      disabled,
      noOptionsMessage: () => noFieldsMessage,
      menuPlacement: 'auto',
    };
    if (takeFocus && field === null) {
      selectProps.autoFocus = true;
    }

    const parameters = this.renderParameterInputs(parameterDescriptions);

    if (fieldValue?.kind === FieldValueKind.EQUATION) {
      return (
        <Container
          className={className}
          gridColumns={1}
          tripleLayout={false}
          error={error !== undefined}
          data-test-id="queryField"
        >
          <ArithmeticInput
            name="arithmetic"
            key="parameter:text"
            type="text"
            required
            value={fieldValue.field}
            onUpdate={this.handleEquationChange}
            options={otherColumns}
            placeholder={t('Equation')}
          />
          {error ? (
            <ArithmeticError title={error}>
              <IconWarning color="errorText" data-test-id="arithmeticErrorWarning" />
            </ArithmeticError>
          ) : null}
        </Container>
      );
    }

    // if there's more than 2 parameters, set gridColumns to 2 so they go onto the next line instead
    const containerColumns =
      parameters.length > 2 ? 2 : gridColumns ? gridColumns : parameters.length + 1;

    let gridColumnsQuantity: undefined | number = undefined;

    if (skipParameterPlaceholder) {
      // if the selected field is a function and has parameters, we would like to display each value in separate columns.
      // Otherwise the field should be displayed in a column, taking up all available space and not displaying the "no parameter" field
      if (fieldValue.kind !== 'function') {
        gridColumnsQuantity = 1;
      } else {
        const operation =
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          AGGREGATIONS[fieldValue.function[0]] ??
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          SESSIONS_OPERATIONS[fieldValue.function[0]];
        if (operation?.parameters.length > 0) {
          if (containerColumns === 3 && operation.parameters.length === 1) {
            gridColumnsQuantity = 2;
          } else {
            gridColumnsQuantity = containerColumns;
          }
        } else {
          gridColumnsQuantity = 1;
        }
      }
    }

    return (
      <Container
        className={className}
        gridColumns={gridColumnsQuantity ?? containerColumns}
        tripleLayout={gridColumns === 3 && parameters.length > 2}
        data-test-id="queryField"
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

export function validateColumnTypes(
  columnTypes: ValidateColumnTypes,
  input: FieldValueColumns
): boolean {
  if (typeof columnTypes === 'function') {
    return columnTypes({name: input.meta.name, dataType: input.meta.dataType});
  }

  return (columnTypes as string[]).includes(input.meta.dataType);
}

const Container = styled('div')<{
  gridColumns: number;
  tripleLayout: boolean;
  error?: boolean;
}>`
  display: grid;
  ${p =>
    p.tripleLayout
      ? `grid-template-columns: 1fr 2fr;`
      : `grid-template-columns: repeat(${p.gridColumns}, 1fr) ${p.error ? 'auto' : ''};`}
  gap: ${space(1)};
  align-items: center;

  flex-grow: 1;
`;

interface BufferedInputProps extends InputProps {
  onUpdate: (value: string) => void;
  value: string;
}
type InputState = {value: string};

/**
 * Because controlled inputs fire onChange on every key stroke,
 * we can't update the QueryField that often as it would re-render
 * the input elements causing focus to be lost.
 *
 * Using a buffered input lets us throttle rendering and enforce data
 * constraints better.
 */
export class BufferedInput extends Component<BufferedInputProps, InputState> {
  constructor(props: BufferedInputProps) {
    super(props);
    this.input = createRef();
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
    if (this.props.required && this.state.value === '') {
      // Handle empty strings separately because we don't pass required
      // to input elements, causing isValid to return true
      this.setState({value: this.props.value});
    } else if (this.isValid) {
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
  min-width: 50px;
`;

const BlankSpace = styled('div')`
  /* Match the height of the select boxes */
  height: ${p => p.theme.form.md.height}px;
  min-width: 50px;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;

  &:after {
    font-size: ${p => p.theme.fontSizeMedium};
    content: '${t('No parameter')}';
    color: ${p => p.theme.subText};
  }
`;

const ArithmeticError = styled(Tooltip)`
  color: ${p => p.theme.errorText};
  animation: ${() => pulse(1.15)} 1s ease infinite;
  display: flex;
`;

export {QueryField};

export function appendFieldIfUnknown(
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
  } else if (field && field.kind === FieldValueKind.CUSTOM_MEASUREMENT) {
    fieldOptions = Object.assign({}, fieldOptions);
    fieldOptions[`measurement:${field.meta.name}`] = {
      label: field.meta.name,
      value: field,
    };
  }

  return fieldOptions;
}
