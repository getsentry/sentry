import React from 'react';

import ContextBlock from './contextBlock';

const AppContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {app_id, app_start_time, binary_cpu_type, binary_sub_cpu_type,
      device_app_hash, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['?ID', app_id],
          ['?Start Time', app_start_time],
          ['?CPU Type', binary_cpu_type],
          ['?CPU Sub Type', binary_sub_cpu_type],
          ['?Hash', device_app_hash],
        ]}
        alias={this.props.alias} />
    );
  }
});

AppContextType.getTitle = function(value) {
  return 'App';
};

export default AppContextType;
