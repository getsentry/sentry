import React from 'react';
import InputField from './inputField';

export default class TextField extends React.Component {
  render() {
    return <InputField {...this.props} type="text" />;
  }
}
