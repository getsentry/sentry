import React from 'react';

import ContextBlock from './contextBlock';

const DeviceContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {name, model, model_id, arch, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['Name', name],
          ['Model', model + (model_id ? ` (${model_id})` : '')],
          ['Architecture', arch]
        ]}
        alias={this.props.alias}
        title="Device" />
    );
  }
});

export default DeviceContextType;
