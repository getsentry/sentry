import PropTypes from 'prop-types';
import React from 'react';
import classnames from 'classnames';

import {flattenedPlatforms} from 'app/views/onboarding/utils';
import PlatformiconTile from 'app/views/onboarding/project/platformiconTile';

class PlatformCard extends React.Component {
  static propTypes = {
    platform: PropTypes.string,
    onClick: PropTypes.func,
  };

  render() {
    let platform = flattenedPlatforms.find(p => p.id === this.props.platform);

    return (
      <span
        className={classnames('platform-card', this.props.className)}
        onClick={this.props.onClick}
      >
        <PlatformiconTile {...this.props} />
        <h5> {platform.name} </h5>
      </span>
    );
  }
}

export default PlatformCard;
