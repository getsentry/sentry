import PropTypes from 'prop-types';
import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';
import {defined} from 'app/utils';

class OsContextType extends React.Component {
  static propTypes = {
    alias: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  render() {
    let {name, version, build, kernel_version, rooted, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['?Name', name],
          ['?Version', version + (build ? ` (${build})` : '')],
          ['?Kernel Version', kernel_version],
          ['?Rooted', defined(rooted) ? (rooted ? 'yes' : 'no') : null],
        ]}
        alias={this.props.alias}
      />
    );
  }
}

OsContextType.getTitle = function(value) {
  return 'Operating System';
};

export default OsContextType;
