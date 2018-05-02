import PropTypes from 'prop-types';
import React from 'react';

class Badge extends React.Component {
  static propTypes = {
    text: PropTypes.string,
    isNew: PropTypes.bool,
  };

  render() {
    let className = 'badge';
    if (this.props.isNew) {
      className += ' new';
    }
    return <span className={className}>{this.props.text}</span>;
  }
}

export default Badge;
