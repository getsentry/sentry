import PropTypes from 'prop-types';
import React from 'react';

import {formatBytes} from 'app/utils';
import getDynamicText from 'app/utils/getDynamicText';

type Props = {
  className?: string;
  bytes: number;
};

function FileSize(props: Props) {
  const {className, bytes} = props;

  return (
    <span className={className}>
      {getDynamicText({value: formatBytes(bytes), fixed: 'xx KB'})}
    </span>
  );
}

FileSize.propTypes = {
  className: PropTypes.string,
  bytes: PropTypes.number.isRequired,
};

export default FileSize;
