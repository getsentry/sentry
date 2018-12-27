import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Platformicon from 'app/components/platformicon';
import space from '../styles/space';

class PlatformList extends React.Component {
  static propTypes = {
    platforms: PropTypes.array,
    direction: PropTypes.oneOf(['right', 'left']),
    /**
     * Maximum number of platform icons to display
     */
    max: PropTypes.number,
    /**
     * Platform icon size in pixels
     */
    size: PropTypes.number,
    /**
     * Will set container width to be size of having `this.props.max` icons
     * This is good for lists where the project name is displayed
     */
    consistentWidth: PropTypes.bool,
  };

  static defaultProps = {
    platforms: [],
    direction: 'right',
    max: 3,
    size: 16,
    consistentWidth: false,
  };

  getIcon = platform => {
    const {size} = this.props;
    return <StyledPlatformIcon key={platform} platform={platform} size={size} />;
  };

  getIcons = platforms => {
    return platforms
      .slice()
      .reverse()
      .map(this.getIcon);
  };

  render() {
    const {platforms, max, size, direction, consistentWidth} = this.props;
    const platformsPreview = platforms.slice(0, max);
    return (
      <PlatformIcons
        direction={direction}
        max={max}
        size={size}
        consistentWidth={consistentWidth}
      >
        {platforms.length > 0 ? (
          this.getIcons(platformsPreview)
        ) : (
          <StyledPlatformIcon size={size} platform="default" />
        )}
      </PlatformIcons>
    );
  }
}

const getOverlapWidth = size => Math.round(size / 4);

const PlatformIcons = styled('div')`
  margin-right: ${space(0.5)};
  display: flex;
  flex-shrink: 0;
  flex-direction: row;
  justify-content: ${p => (p.direction === 'right' ? 'flex-end' : 'flex-start')};
  ${p =>
    p.consistentWidth && `width: ${p.size + (p.max - 1) * getOverlapWidth(p.size)}px;`};
`;

const StyledPlatformIcon = styled(({size, ...props}) => (
  <Platformicon size={`${size}px`} {...props} />
))`
  border-radius: 3px;
  box-shadow: 0 0 0 1px #fff;
  &:not(:first-child) {
    margin-left: ${p => `${p.size * -1 + getOverlapWidth(p.size)}px;`};
  }
`;

export default PlatformList;
