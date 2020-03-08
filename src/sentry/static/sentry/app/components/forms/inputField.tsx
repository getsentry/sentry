import PropTypes from 'prop-types';
import React from 'react';

import FormField from 'app/components/forms/formField';

type InputFieldProps = FormField['props'] & {
  placeholder: string;
  inputStyle?: object;
  onBlur?: (event?: React.FocusEvent<HTMLInputElement>) => void;
};

export default class InputField<
  Props extends InputFieldProps = InputFieldProps,
  State extends FormField['state'] = FormField['state']
> extends FormField<Props, State> {
  static propTypes = {
    ...FormField.propTypes,
    placeholder: PropTypes.string,
  };

  getAttributes() {
    return {};
  }

  getField() {
    return (
      <input
        id={this.getId()}
        type={this.getType()}
        className="form-control"
        placeholder={this.props.placeholder}
        onChange={this.onChange}
        disabled={this.props.disabled}
        name={this.props.name}
        required={this.props.required}
        value={this.state.value as string | number} //can't pass in boolean here
        style={this.props.inputStyle}
        onBlur={this.props.onBlur}
        {...this.getAttributes()}
      />
    );
  }

  getClassName() {
    return 'control-group';
  }

  getType(): string {
    throw new Error('Must be implemented by child.');
  }
}
