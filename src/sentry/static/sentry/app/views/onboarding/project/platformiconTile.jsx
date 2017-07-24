import React from 'react';

const PlatformiconTile = React.createClass({
  propTypes: {
    platform: React.PropTypes.string,
    onClick: React.PropTypes.func,
    className: React.PropTypes.string
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
