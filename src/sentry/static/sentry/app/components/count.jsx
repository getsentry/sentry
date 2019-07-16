import PropTypes from 'prop-types';
import React from 'react';

import formatAbbreviatedNumber from 'app/utils/formatAbbreviatedNumber';

export default class Count extends React.PureComponent {
  static propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  };
  render() {
    const {value, className} = this.props;

    return <span className={className}>{formatAbbreviatedNumber(value)}</span>;
  }
}
