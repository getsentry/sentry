import React from 'react';
import InputField from 'app/views/settings/components/forms/inputField';
import Textarea from 'app/views/settings/components/forms/controls/textarea';

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
