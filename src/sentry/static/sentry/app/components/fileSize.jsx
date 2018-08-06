import PropTypes from 'prop-types';
import React from 'react';
import {formatBytes} from 'app/utils';

class FileSize extends React.Component {
  static propTypes = {
    bytes: PropTypes.number.isRequired,
  };

  render() {
    return <span>{formatBytes(this.props.bytes)}</span>;
  }
}

export default FileSize;
