import React from 'react';

import InputField from 'app/views/settings/components/forms/inputField';

export default class TextField extends React.Component {
  static propTypes = {
    ...InputField.propTypes,
  };

  render() {
    return <InputField {...this.props} type="text" />;
  }
}
