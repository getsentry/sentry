import PropTypes from 'prop-types';
import React from 'react';
import {formatBytes} from 'app/utils';
import getDynamicText from 'app/utils/getDynamicText';

class FileSize extends React.Component {
  static propTypes = {
    bytes: PropTypes.number.isRequired,
  };

  render() {
    return (
      <span>
        {getDynamicText({value: formatBytes(this.props.bytes), fixed: 'xx KB'})}
      </span>
    );
  }
}

export default FileSize;
