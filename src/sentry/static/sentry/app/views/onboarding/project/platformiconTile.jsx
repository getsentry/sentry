import PropTypes from 'prop-types';
import React from 'react';

class PlatformiconTile extends React.Component {
  static propTypes = {
    platform: PropTypes.string,
    className: PropTypes.string,
  };

  render() {
    let {platform, className} = this.props;

    return (
      <li
        className={`platform-tile list-unstyled ${platform} ${platform.split(
          '-'
        )[0]} ${className}`}
      >
        <span className={`platformicon platformicon-${platform}`} />
      </li>
    );
  }
}

export default PlatformiconTile;
