import * as React from 'react';
import {OptionsType, ValueType} from 'react-select';

import SelectControl, {ControlProps} from 'app/components/forms/selectControl';
import {Choices, SelectValue} from 'app/types';
import InputField from 'app/views/settings/components/forms/inputField';

type InputFieldProps = React.ComponentProps<typeof InputField>;

type Props<OptionType> = InputFieldProps &
  Omit<ControlProps<OptionType>, 'onChange'> & {
    /**
     * Should the select be clearable?
     */
    allowClear?: boolean;
    /**
     * Should the select allow empty values?
     */
    allowEmpty?: boolean;
    small?: boolean;
    /**
     * A label that is shown inside the select control.
     */
    inFieldLabel?: string;
  };

function getChoices<T>(props: Props<T>): Choices {
  const choices = props.choices;
  if (typeof choices === 'function') {
    return choices(props);
  }
  if (choices === undefined) {
    return [];
  }

  return choices;
}

/**
 * Required to type guard for OptionsType<T> which is a readonly Array
 */
function isArray<T>(maybe: T | OptionsType<T>): maybe is OptionsType<T> {
  return Array.isArray(maybe);
}

export default class SelectField<
  OptionType extends SelectValue<any>
> extends React.Component<Props<OptionType>> {
  static defaultProps = {
    allowClear: false,
    allowEmpty: false,
    placeholder: '--',
    escapeMarkup: true,
    multiple: false,
    small: false,
    formatMessageValue: (value, props) =>
      (getChoices(props).find(choice => choice[0] === value) || [null, value])[1],
  };

  handleChange = (
    onBlur: InputFieldProps['onBlur'],
    onChange: InputFieldProps['onChange'],
    optionObj: ValueType<OptionType>
  ) => {
    let value: any = undefined;

    // If optionObj is empty, then it probably means that the field was "cleared"
    if (!optionObj) {
      value = optionObj;
    } else if (this.props.multiple && isArray(optionObj)) {
      // List of optionObjs
      value = optionObj.map(({value: val}) => val);
    } else if (!isArray(optionObj)) {
      value = optionObj.value;
    }

    onChange?.(value, {});
    onBlur?.(value, {});
  };

  render() {
    const {multiple, allowClear, small, ...otherProps} = this.props;
    return (
      <InputField
        {...otherProps}
        alignRight={small}
        field={({onChange, onBlur, required: _required, ...props}) => (
          <SelectControl
            {...props}
            clearable={allowClear}
            multiple={multiple}
            onChange={this.handleChange.bind(this, onBlur, onChange)}
          />
        )}
      />
    );
  }
}
