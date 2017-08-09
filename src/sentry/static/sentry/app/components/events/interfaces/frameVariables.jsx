import React from 'react';

import {objectToArray} from '../../../utils';
import KeyValueList from './keyValueList';

const FrameVariables = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  preventToggling(evt) {
    evt.stopPropagation();
  },

  render() {
    let data = objectToArray(this.props.data);

    return (
      <KeyValueList data={data} isContextData={true} onClick={this.preventToggling} />
    );
  }
});

export default FrameVariables;
