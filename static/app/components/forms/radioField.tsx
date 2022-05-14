import {Component} from 'react';

import RadioGroup, {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import InputField, {InputFieldProps, onEvent} from 'sentry/components/forms/inputField';

export interface RadioFieldProps extends Omit<InputFieldProps, 'type'> {
  choices?: RadioGroupProps<any>['choices'];
  orientInline?: RadioGroupProps<any>['orientInline'];
}

class RadioField extends Component<RadioFieldProps> {
  onChange = (
    id: string,
    onChange: onEvent,
    onBlur: onEvent,
    e: React.FormEvent<HTMLInputElement>
  ) => {
    onChange(id, e);
    onBlur(id, e);
  };

  render() {
    return (
      <InputField
        {...this.props}
        field={({onChange, onBlur, value, disabled, orientInline, ...props}) => (
          <RadioGroup
            choices={props.choices}
            disabled={disabled}
            orientInline={orientInline}
            value={value === '' ? null : value}
            label={props.label}
            onChange={(id, e) => this.onChange(id, onChange, onBlur, e)}
          />
        )}
      />
    );
  }
}

export default RadioField;
