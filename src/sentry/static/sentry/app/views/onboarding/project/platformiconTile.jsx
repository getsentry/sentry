import React from 'react';

const PlatformiconTile = React.createClass({
  propTypes: {
    platform: React.PropTypes.string,
    onClick: React.PropTypes.func
  },

  render() {
    return (
      <li
        className={`platform-tile ${this.props.platform} ${this.props.platform.split('-')[0]} ${this.props.className}`}
        onClick={this.props.onClick}>
        <span className={`platformicon platformicon-${this.props.platform}`} />
      </li>
    );
  }
});

export default PlatformiconTile;
