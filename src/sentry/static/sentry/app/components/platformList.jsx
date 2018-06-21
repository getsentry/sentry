import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Platformicon from 'app/components/platformicon';
import space from '../styles/space';

const MAX_PLATFORMS = 3;
const ICON_SIZE = 16;

class PlatformList extends React.Component {
  static propTypes = {
    platforms: PropTypes.array,
    direction: PropTypes.string,
  };

  static defaultProps = {
    platforms: [],
    direction: 'right',
  };

  getIcon(platform) {
    return (
      <StyledPlatformIcon key={platform} platform={platform} size={ICON_SIZE + 'px'} />
    );
  }

  getIcons(platforms) {
    return platforms
      .slice()
      .reverse()
      .map(this.getIcon);
  }

  render() {
    const {platforms} = this.props;
    const platformsPreview = platforms.slice(0, MAX_PLATFORMS);
    return (
      <PlatformIcons direction={this.props.direction}>
        {platforms.length > 0 ? (
          this.getIcons(platformsPreview)
        ) : (
          <StyledPlatformIcon size={ICON_SIZE + 'px'} platform="default" />
        )}
      </PlatformIcons>
    );
  }
}

const PlatformIcons = styled('div')`
  margin-right: ${space(0.5)};
  display: flex;
  flex-direction: row;
  justify-content: ${p => (p.direction == 'left' ? 'flex-end' : 'flex-start')};
  width: 24px;
`;

const StyledPlatformIcon = styled(Platformicon)`
  border-radius: 3px;
  box-shadow: 0 0 0 1px #fff;
  &:not(:first-child) {
    margin-left: ${ICON_SIZE * -1 + 4}px;
  }
`;

export default PlatformList;
