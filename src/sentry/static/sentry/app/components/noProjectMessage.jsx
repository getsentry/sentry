import React from 'react';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import Button from 'app/components/button';
import PageHeading from 'app/components/pageHeading';
import Tooltip from 'app/components/tooltip';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import img from '../../images/confused-io.png';

export default class EmptyState extends React.Component {
  static propTypes = {
    /* if the user has access to any projects, the wrapper
    will expose whatever children are included */
    children: PropTypes.node,
    organization: SentryTypes.Organization,
    className: PropTypes.string,
  };

  render() {
    const {children, organization, className} = this.props;
    const orgId = organization.slug;
    const canCreateProject = organization.access.includes('project:write');
    const canJoinTeam = organization.access.includes('team:read');
    const hasProjects =
      organization.projects.filter(p => p.isMember && p.hasAccess).length !== 0;

    return hasProjects ? (
      children
    ) : (
      <Flex flex="1" align="center" justify="center" className={className}>
        <Wrapper>
          <img src={img} height={350} alt="Nothing to see" />
          <Content direction="column" justify="center">
            <StyledPageHeading>{t('Hmmm')}</StyledPageHeading>
            <HelpMessage>
              {t('You need at least one project to use this view')}
            </HelpMessage>
            <Flex align="center">
              <CallToAction>
                <Tooltip
                  disabled={canJoinTeam}
                  title={t('You do not have permission to join a team.')}
                >
                  <Button
                    disabled={!canJoinTeam}
                    priority="primary"
                    to={`/settings/${orgId}/teams/`}
                  >
                    {t('Join a Team')}
                  </Button>
                </Tooltip>
              </CallToAction>

              <CallToAction>
                <Tooltip
                  disabled={canCreateProject}
                  title={t('You do not have permission to create a project.')}
                >
                  <Button
                    disabled={!canCreateProject}
                    to={`/organizations/${orgId}/projects/new/`}
                  >
                    {t('Create project')}
                  </Button>
                </Tooltip>
              </CallToAction>
            </Flex>
          </Content>
        </Wrapper>
      </Flex>
    );
  }
}

const StyledPageHeading = styled(PageHeading)`
  font-size: 28px;
  margin-bottom: ${space(1.5)};
`;

const CallToAction = styled('div')`
  margin-right: 8px;
  &:last-child {
    margin-right: 0;
  }
`;

const HelpMessage = styled('div')`
  margin-bottom: ${space(2)};
`;

const Wrapper = styled(Flex)`
  height: 350px;
`;

const Content = styled(Flex)`
  margin-left: 40px;
  margin-top: ${space(4)};
`;
