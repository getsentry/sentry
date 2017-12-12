import React from 'react';
import InputField from './inputField';
import Textarea from './styled/textarea';

export default class TextareaField extends InputField {
  render() {
    return (
      <InputField
        {...this.props}
        field={({children, ...fieldProps}) => <Textarea {...fieldProps} />}
      />
    );
  }
}
