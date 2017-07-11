import React from 'react';
// import {platforms} from '../../../../../../integration-docs/_platforms.json';
import {flattenedPlatforms} from '../utils';
import PlatformiconTile from './platformiconTile';

const PlatformCard = React.createClass({
  propTypes: {
    platform: React.PropTypes.string,
    onClick: React.PropTypes.func
  },

  render() {
    const platform = flattenedPlatforms.find(p => p.id === this.props.platform);
    if (!platform) return false;
    return (
      <div style={{display: 'flex'}}>
        <PlatformiconTile {...this.props} />
        <h4> {platform.name}</h4>
      </div>
    );
  }
});

export default PlatformCard;
