import React from 'react';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import SentryTypes from 'app/proptypes';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import Platformicon from 'app/components/platformicon';

const MAX_PLATFORMS = 5;

class PlatformList extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
    orgId: PropTypes.string,
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
    const {project, orgId} = this.props;
    const platforms =
      project && project.platforms && project.platforms.slice(0, MAX_PLATFORMS);

    const link = `/${orgId}/${project.slug}/getting-started/${project.platform
      ? project.platform + '/'
      : ''}`;

    if (!platforms || !platforms.length) {
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
        <div className="org-dashboard-platform-list">{this.getIcons(platforms)}</div>
        <PlatformText>{platforms.join(', ')}</PlatformText>
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

const NoPlatforms = styled(Flex)`
  color: ${p => p.theme.gray2};
  height: 56px;
`;

export default withRouter(PlatformList);
