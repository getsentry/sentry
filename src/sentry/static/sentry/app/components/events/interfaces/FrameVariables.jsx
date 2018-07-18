import PropTypes from 'prop-types';
import React from 'react';

import {objectToArray} from 'app/utils';
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
    let data = objectToArray(this.props.data);

    return (
      <KeyValueList data={data} isContextData={true} onClick={this.preventToggling} />
    );
  }
}

export default FrameVariables;
