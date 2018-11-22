import React from 'react';

import InputField from './inputField';

export default class EmailField extends React.Component {
  render() {
    return <InputField {...this.props} type="email" />;
  }
}
