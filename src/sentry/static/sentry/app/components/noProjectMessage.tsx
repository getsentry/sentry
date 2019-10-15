import React from 'react';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import Button from 'app/components/button';
import PageHeading from 'app/components/pageHeading';
import Tooltip from 'app/components/tooltip';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import ConfigStore from 'app/stores/configStore';
/* TODO: replace with I/O when finished */
import img from '../../images/dashboard/hair-on-fire.svg';

type Props = {
  organization: Organization;
};

export default class NoProjectMessage extends React.Component<Props> {
  static propTypes = {
    /* if the user has access to any projects, we show whatever
    children are included. Otherwise we show the message */
    children: PropTypes.node,
    organization: SentryTypes.Organization,
  };

  render() {
    const {children, organization} = this.props;
    const orgId = organization.slug;
    const canCreateProject = organization.access.includes('project:write');
    const canJoinTeam = organization.access.includes('team:read');

    const {isSuperuser} = ConfigStore.get('user');

    const hasProjects = isSuperuser
      ? organization.projects.some(p => p.hasAccess)
      : organization.projects.some(p => p.isMember && p.hasAccess);

    return hasProjects ? (
      children
    ) : (
      <Flex flex="1" align="center" justify="center">
        <Wrapper>
          <img src={img} height={350} alt="Nothing to see" />
          <Content direction="column" justify="center">
            <StyledPageHeading>{t('Remain Calm')}</StyledPageHeading>
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
`;
