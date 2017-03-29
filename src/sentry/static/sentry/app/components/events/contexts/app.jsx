import React from 'react';

import ContextBlock from './contextBlock';

const AppContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {app_id, app_start_time, device_app_hash, build_type,
      app_identifier, app_name, app_short_version,
      app_version, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['?ID', app_id],
          ['?Start Time', app_start_time],
          ['?Device', device_app_hash],
          ['?Build Type', build_type],
          ['?Bundle ID', app_identifier],
          ['?Bundle Name', app_name],
          ['?Version', app_short_version],
          ['?Build', app_version],
        ]}
        alias={this.props.alias} />
    );
  }
});

AppContextType.getTitle = function(value) {
  return 'App';
};

export default AppContextType;
