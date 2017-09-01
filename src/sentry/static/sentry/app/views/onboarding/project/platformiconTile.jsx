import PropTypes from 'prop-types';
import React from 'react';

const PlatformiconTile = React.createClass({
  propTypes: {
    platform: PropTypes.string,
    onClick: PropTypes.func,
    className: PropTypes.string
  },

  render() {
    let {platform, className, onClick} = this.props;

    return (
      <li
        className={`platform-tile list-unstyled ${platform} ${platform.split('-')[0]} ${className}`}
        onClick={onClick}>
        <span className={`platformicon platformicon-${platform}`} />
      </li>
    );
  }
});

export default PlatformiconTile;
