import React from 'react';

import InputField from './inputField';
import RadioBoolean from './controls/radioBoolean';

export default class RadioBooleanField extends React.Component {
  render() {
    return (
      <InputField
        {...this.props}
        field={({children, onKeyDown, ...fieldProps}) => <RadioBoolean {...fieldProps} />}
      />
    );
  }
}
