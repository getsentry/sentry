import React from 'react';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import SentryTypes from 'app/proptypes';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import PlatformIcon from 'app/components/platformIcon';

const MAX_PLATFORMS = 5;

class PlatformList extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
    orgId: PropTypes.string,
  };

  getIcon(platform) {
    return (
      <StyledPlatformIconWrapper key={platform} className={platform}>
        <StyledPlatformIcon name={platform} />
      </StyledPlatformIconWrapper>
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
    const {project, orgId} = this.props;
    const platforms = project.platforms.slice(0, MAX_PLATFORMS);

    const link = `/${orgId}/${project.slug}/getting-started/${project.platform
      ? project.platform + '/'
      : ''}`;

    if (!platforms.length) {
      return (
        <NoPlatforms align="center" p={2}>
          {project.firstEvent ? (
            t('No platforms yet')
          ) : (
            <Button size="small" to={link}>
              {t('Install an SDK')}
            </Button>
          )}
        </NoPlatforms>
      );
    }

    return (
      <Flex align="center">
        <div>{this.getIcons(platforms)}</div>
        <PlatformText>{platforms.join(', ')}</PlatformText>
      </Flex>
    );
  }
}

const StyledPlatformIconWrapper = styled.span`
  display: block;
  margin-right: -14px;
  margin-left: -2px;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  border-radius: 4px;
  border: 2px solid white;
`;

const PlatformText = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 13px;
  line-height: 13px;
`;

const NoPlatforms = styled(Flex)`
  color: ${p => p.theme.gray2};
  height: 66px;
`;

export default withRouter(PlatformList);
