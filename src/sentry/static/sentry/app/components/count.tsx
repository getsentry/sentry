import PropTypes from 'prop-types';
import React from 'react';

import {formatAbbreviatedNumber} from 'app/utils/formatters';

type Props = {
  value: string | number;
  className?: string;
};

function Count(props: Props) {
  const {value, className} = props;

  return <span className={className} title={value}>{formatAbbreviatedNumber(value)}</span>;
}
Count.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default Count;
