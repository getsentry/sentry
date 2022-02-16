import * as React from 'react';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import InputField, {onEvent} from 'sentry/components/forms/inputField';

type RadioGroupProps = React.ComponentProps<typeof RadioGroup>;

type Props = Omit<InputField['props'], 'type'> &
  Pick<RadioGroupProps, 'choices' | 'orientInline'>;

class RadioField extends React.Component<Props> {
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
