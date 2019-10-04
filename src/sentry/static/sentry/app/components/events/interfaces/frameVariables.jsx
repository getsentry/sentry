import PropTypes from 'prop-types';
import React from 'react';

import KeyValueList from 'app/components/events/interfaces/keyValueList';

class FrameVariables extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  preventToggling = evt => {
    evt.stopPropagation();
  };

  render() {
    const data = Object.entries(this.props.data);

    return <KeyValueList data={data} isContextData onClick={this.preventToggling} />;
  }
}

export default FrameVariables;
