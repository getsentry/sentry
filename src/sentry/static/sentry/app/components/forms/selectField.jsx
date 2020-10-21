import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {defined} from 'app/utils';

import {StyledForm} from './form';
import FormField from './formField';
import SelectControl from './selectControl';

export default class SelectField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    options: SelectControl.propTypes.options,
    choices: SelectControl.propTypes.choices,
    clearable: SelectControl.propTypes.clearable,
    onChange: PropTypes.func,
    multiple: PropTypes.bool,
    deprecatedSelectControl: PropTypes.bool,
  };

  static defaultProps = {
    ...FormField.defaultProps,
    clearable: true,
    multiple: false,
  };

  UNSAFE_componentWillReceiveProps(nextProps, nextContext) {
    const newError = this.getError(nextProps, nextContext);
    if (newError !== this.state.error) {
      this.setState({error: newError});
    }
    if (this.props.value !== nextProps.value || defined(nextContext.form)) {
      const newValue = this.getValue(nextProps, nextContext);
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
  getValue(props, context) {
    const form = (context || this.context || {}).form;
    props = props || this.props;

    // Don't use `isMultiple` here because we're taking props from args as well
    const defaultValue = this.isMultiple(props) ? [] : '';

    if (defined(props.value)) {
      return props.value;
    }
    if (form && form.data.hasOwnProperty(props.name)) {
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
  coerceValue(value) {
    if (!value) {
      return '';
    }

    if (this.isMultiple()) {
      return value.map(v => v.value);
    } else if (value.hasOwnProperty('value')) {
      return value.value;
    }

    return value;
  }

  isMultiple(props) {
    props = props || this.props;
    // this is to maintain compatibility with the 'multi' prop
    return props.multi || props.multiple;
  }

  getClassName() {
    return '';
  }

  onChange = opt => {
    // Changing this will most likely break react-select (e.g. you won't be able to select
    // a menu option that is from an async request, or a multi select).
    this.setValue(opt);
  };

  getField() {
    const {
      deprecatedSelectControl,
      options,
      clearable,
      creatable,
      choices,
      placeholder,
      disabled,
      required,
      name,
      isLoading,
    } = this.props;

    return (
      <StyledSelectControl
        deprecatedSelectControl={deprecatedSelectControl}
        creatable={creatable}
        id={this.getId()}
        choices={choices}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
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
const StyledSelectControl = styled(SelectControl)`
  ${StyledForm} &, .form-stacked & {
    .control-group & {
      margin-bottom: 0;
    }

    margin-bottom: 15px;
  }
`;
