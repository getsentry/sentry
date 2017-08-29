import PropTypes from 'prop-types';
import React from 'react';
import {formatBytes} from '../utils';

const FileSize = React.createClass({
  propTypes: {
    bytes: PropTypes.number.isRequired
  },

  render: function() {
    return <span>{formatBytes(this.props.bytes)}</span>;
  }
});

export default FileSize;
