import React from 'react';
import InputField from 'app/views/settings/components/forms/inputField';
import Textarea from 'app/views/settings/components/forms/controls/textarea';

export default class TextareaField extends React.Component {
  render() {
    return (
      <InputField
        {...this.props}
        field={({children, onKeyDown, ...fieldProps}) => <Textarea {...fieldProps} />}
      />
    );
  }
}
