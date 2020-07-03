import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {LightWeightOrganization, Organization, Project} from 'app/types';
import Button from 'app/components/button';
import PageHeading from 'app/components/pageHeading';
import Tooltip from 'app/components/tooltip';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import ConfigStore from 'app/stores/configStore';

/* TODO: replace with I/O when finished */
import img from '../../images/spot/hair-on-fire.svg';

type Props = {
  organization: LightWeightOrganization | Organization;
  projects?: Project[];
  loadingProjects?: boolean;
};

export default class NoProjectMessage extends React.Component<Props> {
  static propTypes = {
    /* if the user has access to any projects, we show whatever
    children are included. Otherwise we show the message */
    children: PropTypes.node,
    organization: SentryTypes.Organization,
    projects: PropTypes.arrayOf(SentryTypes.Project),
    loadingProjects: PropTypes.bool,
  };

  render() {
    const {children, organization, projects, loadingProjects} = this.props;
    const orgId = organization.slug;
    const canCreateProject = organization.access.includes('project:write');
    const canJoinTeam = organization.access.includes('team:read');

    let hasProjects;
    if ('projects' in organization) {
      const {isSuperuser} = ConfigStore.get('user');

      hasProjects = isSuperuser
        ? organization.projects.some(p => p.hasAccess)
        : organization.projects.some(p => p.isMember && p.hasAccess);
    } else {
      hasProjects = projects && projects.length > 0;
    }

    return hasProjects || loadingProjects ? (
      children
    ) : (
      <Wrapper>
        <HeightWrapper>
          <img src={img} height={350} alt="Nothing to see" />
          <Content>
            <StyledPageHeading>{t('Remain Calm')}</StyledPageHeading>
            <HelpMessage>
              {t('You need at least one project to use this view')}
            </HelpMessage>
            <CallToActions>
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
            </CallToActions>
          </Content>
        </HeightWrapper>
      </Wrapper>
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

const Flex = styled('div')`
  display: flex;
`;

const Wrapper = styled(Flex)`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const HeightWrapper = styled(Flex)`
  height: 350px;
`;

const Content = styled(Flex)`
  flex-direction: column;
  justify-content: center;
  margin-left: 40px;
`;

const CallToActions = styled(Flex)`
  align-items: center;
`;
