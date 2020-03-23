import React from 'react';
import omit from 'lodash/omit';

import InputField from 'app/views/settings/components/forms/inputField';
import Textarea from 'app/views/settings/components/forms/controls/textarea';

export default class TextareaField extends React.Component {
  render() {
    return (
      <InputField
        {...this.props}
        field={fieldProps => (
          <Textarea {...omit(fieldProps, ['onKeyDown', 'children'])} />
        )}
      />
    );
  }
}
