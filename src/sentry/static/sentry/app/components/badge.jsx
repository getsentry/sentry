import PropTypes from 'prop-types';
import React from 'react';
import {cx} from 'react-emotion';

class Badge extends React.Component {
  static propTypes = {
    text: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    priority: PropTypes.oneOf(['strong', 'new', 'highlight']),
  };

  render() {
    const {priority, className, text} = this.props;
    return <span className={cx('badge', priority, className)}>{text}</span>;
  }
}

export default Badge;
