import React from 'react';

import ContextBlock from './contextBlock';
import {defined} from '../../../utils';

const OsContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {name, version, build, kernel_version, rooted, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['?Name', name],
          ['Version', version + (build ? ` (${build})` : '')],
          ['Kernel Version', kernel_version],
          ['?Rooted', defined(rooted) ? (rooted ? 'yes' : 'no') : null],
        ]}
        alias={this.props.alias} />
    );
  }
});

OsContextType.getTitle = function(value) {
  return 'Operating System';
};

export default OsContextType;
