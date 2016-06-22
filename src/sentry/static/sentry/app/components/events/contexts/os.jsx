import React from 'react';

import ContextBlock from './contextBlock';

const OsContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {name, version, build, kernel_version, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['Name', name],
          ['Version', version + (build ? ` (${build})` : '')],
          ['Kernel Version', kernel_version],
        ]}
        alias={this.props.alias} />
    );
  }
});

export default OsContextType;
