import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import Platformicon from 'app/components/platformicon';

const MAX_PLATFORMS = 3;

class PlatformList extends React.Component {
  static propTypes = {
    platforms: PropTypes.array,
    subtextOn: PropTypes.bool,
  };

  getIcon(platform) {
    return (
      <StyledPlatformiconWrapper key={platform}>
        <StyledPlatformicon platform={platform} size="24" />
      </StyledPlatformiconWrapper>
    );
  }

  getIcons(platforms) {
    return (
      <Flex direction="row-reverse" p={2}>
        {platforms
          .slice()
          .reverse()
          .map(this.getIcon)}
      </Flex>
    );
  }
  render() {
    const {platforms, subtextOn} = this.props;
    const platformsPreview = platforms.slice(0, MAX_PLATFORMS);

    return (
      <Flex align="center">
        <div className="client-platform-list">{this.getIcons(platformsPreview)}</div>
        {subtextOn ? <PlatformText>{platformsPreview.join(', ')}</PlatformText> : null}
      </Flex>
    );
  }
}

const StyledPlatformiconWrapper = styled.span`
  display: block;
  margin-right: -8px;
`;

const StyledPlatformicon = styled(Platformicon)`
  display: block;
  color: white;
  font-size: 22px;
  border-radius: 4px;
  box-shadow: 0 0 0 2px #fff;
  max-width: 24px;
`;

const PlatformText = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 13px;
  line-height: 13px;
`;

export default PlatformList;
