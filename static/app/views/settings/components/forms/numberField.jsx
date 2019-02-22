import React from 'react';

import InputField from './inputField';

export default class NumberField extends React.Component {
  render() {
    return <InputField {...this.props} type="number" />;
  }
}
