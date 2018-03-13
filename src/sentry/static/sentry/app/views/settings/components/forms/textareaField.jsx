import React from 'react';
import InputField from './inputField';
import Textarea from './controls/textarea';

export default class TextareaField extends InputField {
  render() {
    return (
      <InputField
        {...this.props}
        field={({children, onKeyDown, ...fieldProps}) => <Textarea {...fieldProps} />}
      />
    );
  }
}
