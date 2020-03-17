import React from 'react';
import omit from 'lodash/omit';

import InputField from './inputField';
import RadioBoolean from './controls/radioBoolean';

export default class RadioBooleanField extends React.Component {
  render() {
    return (
      <InputField
        {...this.props}
        field={fieldProps => (
          <RadioBoolean {...omit(fieldProps, ['onKeyDown', 'children'])} />
        )}
      />
    );
  }
}
