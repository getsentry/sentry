import styled from '@emotion/styled';

import {Select} from '@sentry/scraps/select';

import withFormContext from 'sentry/components/deprecatedforms/withFormContext';
import {defined} from 'sentry/utils';

import {StyledForm} from './form';
import FormField, {type FormFieldProps} from './formField';

// Combined interface for SelectField props
export interface SelectFieldProps extends FormFieldProps {
  // Modified to accept various choice formats
  choices?: Array<[value: any, label: string | number]> | string[][] | string[];
  clearable?: boolean;
  // legacy prop for backward compatibility
  creatable?: boolean;
  // Additional select behavior
  defaultValue?: any;
  isLoading?: boolean;
  multi?: boolean;
  multiple?: boolean;
  // Core select properties
  options?: Array<{label: string; value: any}>;
  placeholder?: string;
}

/**
 * @deprecated Do not use this
 */
export class SelectField extends FormField<SelectFieldProps> {
  static defaultProps = {
    ...FormField.defaultProps,
    clearable: true,
    multiple: false,
  };

  UNSAFE_componentWillReceiveProps(nextProps: SelectFieldProps) {
    const newError = this.getError(nextProps);
    if (newError !== this.state.error) {
      this.setState({error: newError});
    }
    if (this.props.value !== nextProps.value || defined(nextProps.formContext.form)) {
      const newValue = this.getValue(nextProps);
      // This is the only thing that is different from parent, we compare newValue against coerced value in state
      // To remain compatible with react-select, we need to store the option object that
      // includes `value` and `label`, but when we submit the format, we need to coerce it
      // to just return `value`. Also when field changes, it propagates the coerced value up
      const coercedValue = this.coerceValue(this.state.value);

      // newValue can be empty string because of `getValue`, while coerceValue needs to return null (to differentiate
      // empty string from cleared item). We could use `!=` to compare, but lets be a bit more explicit with strict equality
      //
      // This can happen when this is apart of a field, and it re-renders onChange for a different field,
      // there will be a mismatch between this component's state.value and `this.getValue` result above
      if (newValue !== coercedValue && !!newValue !== !!coercedValue) {
        this.setValue(newValue);
      }
    }
  }

  // Overriding this so that we can support `multi` fields through property
  getValue(props: SelectFieldProps) {
    const form = (props.formContext || this.props.formContext)?.form;
    props = props || this.props;

    // Don't use `isMultiple` here because we're taking props from args as well
    const defaultValue = this.isMultiple(props) ? [] : '';

    if (defined(props.value)) {
      return props.value;
    }
    if (form?.data.hasOwnProperty(props.name)) {
      return defined(form.data[props.name]) ? form.data[props.name] : defaultValue;
    }
    return defined(props.defaultValue) ? props.defaultValue : defaultValue;
  }

  // We need this to get react-select's `Creatable` to work properly
  // Otherwise, when you hit "enter" to create a new item, the "selected value" does
  // not update with new value (and also new value is not displayed in dropdown)
  //
  // This is also needed to get `multi` select working since we need the {label, value} object
  // for react-select (but forms expect just the value to be propagated)
  coerceValue(value: any) {
    if (!value) {
      return '';
    }

    if (this.isMultiple()) {
      return value.map((v: any) => v.value);
    }
    if (value.hasOwnProperty('value')) {
      return value.value;
    }

    return value;
  }

  isMultiple(props?: SelectFieldProps) {
    props = props || this.props;
    // this is to maintain compatibility with the 'multi' prop
    return props.multi || props.multiple;
  }

  getClassName() {
    return '';
  }

  onChange = (opt: any) => {
    // Changing this will most likely break react-select (e.g. you won't be able to select
    // a menu option that is from an async request, or a multi select).
    this.setValue(opt);
  };

  getField() {
    const {
      options,
      clearable,
      creatable,
      choices,
      placeholder,
      disabled,
      name,
      isLoading,
    } = this.props;

    return (
      <StyledSelectControl
        creatable={creatable}
        inputId={this.getId()}
        choices={choices}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        value={this.state.value}
        onChange={this.onChange}
        clearable={clearable}
        multiple={this.isMultiple()}
        name={name}
        isLoading={isLoading}
      />
    );
  }
}

// This is to match other fields that are wrapped by a `div.control-group`
const StyledSelectControl = styled(Select)`
  ${StyledForm} &, .form-stacked & {
    .control-group & {
      margin-bottom: 0;
    }

    margin-bottom: 15px;
  }
`;

/**
 * @deprecated Do not use this
 */
export default withFormContext(SelectField);
