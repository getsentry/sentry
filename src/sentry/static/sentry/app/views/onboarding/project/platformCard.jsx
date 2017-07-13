import React from 'react';
// import {platforms} from '../../../../../../integration-docs/_platforms.json';
import {flattenedPlatforms} from '../utils';
import PlatformiconTile from './platformiconTile';
import classnames from 'classnames';

const PlatformCard = React.createClass({
  propTypes: {
    platform: React.PropTypes.string,
    onClick: React.PropTypes.func
  },

  render() {
    const platform = flattenedPlatforms.find(p => p.id === this.props.platform);
    return (
      <span className={classnames('platform-card', this.props.className)}>
        <PlatformiconTile {...this.props} />
        <h5> {platform.name} </h5>
      </span>
    );
  }
});

export default PlatformCard;
