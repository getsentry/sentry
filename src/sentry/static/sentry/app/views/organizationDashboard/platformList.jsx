import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';
import {t} from 'app/locale';

export default class PlatformList extends React.Component {
  static propTypes = {
    platforms: PropTypes.arrayOf(PropTypes.string),
  };

  getIcon(platform) {
    return (
      <StyledPlatformIconWrapper key={platform} className={platform}>
        <StyledPlatformIcon className={`platformicon platformicon-${platform}`} />
      </StyledPlatformIconWrapper>
    );
  }

  getIcons(platforms) {
    return (
      <Flex direction="row-reverse" p={2}>
        {platforms.map(this.getIcon)}
      </Flex>
    );
  }
  render() {
    const {platforms} = this.props;

    if (!platforms.length)
      return (
        <NoPlatforms align="center" p={2}>
          {t('No platforms yet')}
        </NoPlatforms>
      );

    return (
      <Flex align="center">
        <div className="org-dashboard-platform-list">{this.getIcons(platforms)}</div>
        <PlatformText>
          {platforms
            .slice()
            .reverse()
            .join(', ')}
        </PlatformText>
      </Flex>
    );
  }
}

const StyledPlatformIconWrapper = styled.span`
  display: block;
  margin-right: -14px;
  margin-left: -2px;
`;

const StyledPlatformIcon = styled.span`
  display: block;
  color: white;
  height: 34px;
  width: 34px;
  font-size: 22px;
  border-radius: 4px;
  border: 2px solid white;
  padding: 4px;
`;

const PlatformText = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 13px;
`;

const NoPlatforms = styled(Flex)`
  color: ${p => p.theme.gray2};
  height: 70px;
`;
