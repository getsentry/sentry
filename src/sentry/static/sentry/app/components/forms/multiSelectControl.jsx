import React from 'react';

import SelectControl from 'app/components/forms/selectControl';

export default class MultiSelectControl extends React.Component {
  render() {
    return (
      <SelectControl
        style={{width: 200, overflow: 'visible'}}
        {...this.props}
        multi={true}
      />
    );
  }
}
