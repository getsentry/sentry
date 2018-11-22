import React from 'react';

import InputField from './inputField';

export default class DateTimeField extends React.Component {
  render() {
    return <InputField {...this.props} type="datetime-local" />;
  }
}
