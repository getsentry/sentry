import React from 'react';

import ContextBlock from './contextBlock';

const RuntimeContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {name, version, build, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['Name', name],
          ['Version', version + (build ? ` (${build})` : '')],
        ]}
        alias={this.props.alias} />
    );
  }
});

RuntimeContextType.getTitle = function(value) {
  return 'Runtime';
};

export default RuntimeContextType;
