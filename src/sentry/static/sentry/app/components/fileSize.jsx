import React from 'react';
import {formatBytes} from '../utils';

const FileSize = React.createClass({
  propTypes: {
    bytes: React.PropTypes.number.isRequired
  },

  render: function() {
    return <span>{formatBytes(this.props.bytes)}</span>;
  }
});

export default FileSize;
