import React from 'react';

const Badge = React.createClass({
  propTypes: {
    text: React.PropTypes.string,
    isNew: React.PropTypes.bool
  },

  render() {
    let className = 'badge';
    if (this.props.isNew) {
      className += ' new';
    }
    return <span className={className}>{this.props.text}</span>;
  }
});

export default Badge;
