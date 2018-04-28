import React from 'react';

import SelectControl from 'app/components/forms/selectControl';

export default class MultiSelectControl extends React.Component {
  render() {
    return <SelectControl {...this.props} multi={true} />;
  }
}
