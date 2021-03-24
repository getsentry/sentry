import React from 'react';
import styled from '@emotion/styled';

/* TODO: replace with I/O when finished */
import img from 'sentry-images/spot/hair-on-fire.svg';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import PageHeading from 'app/components/pageHeading';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import {LightWeightOrganization, Organization, Project} from 'app/types';

type Props = {
  organization: LightWeightOrganization | Organization;
  projects?: Project[];
  loadingProjects?: boolean;
  superuserNeedsToBeProjectMember?: boolean;
};

export default class NoProjectMessage extends React.Component<Props> {
  render() {
    const {
      children,
      organization,
      projects,
      loadingProjects,
      superuserNeedsToBeProjectMember,
    } = this.props;
    const orgId = organization.slug;
    const canCreateProject = organization.access.includes('project:write');
    const canJoinTeam = organization.access.includes('team:read');

    let orgHasProjects: boolean;
    let hasProjectAccess: boolean;

    if ('projects' in organization) {
      const {isSuperuser} = ConfigStore.get('user');

      orgHasProjects = organization.projects.length > 0;
      hasProjectAccess =
        isSuperuser && !superuserNeedsToBeProjectMember
          ? organization.projects.some(p => p.hasAccess)
          : organization.projects.some(p => p.isMember && p.hasAccess);
    } else {
      hasProjectAccess = projects ? projects.length > 0 : false;
      orgHasProjects = hasProjectAccess;
    }

    if (hasProjectAccess || loadingProjects) {
      return children;
    }

    // If the organization has some projects, but the user doesn't have access to
    // those projects, the primary action is to Join a Team. Otherwise the primary
    // action is to create a project.

    const joinTeamAction = (
      <Button
        title={canJoinTeam ? undefined : t('You do not have permission to join a team.')}
        disabled={!canJoinTeam}
        priority={orgHasProjects ? 'primary' : 'default'}
        to={`/settings/${orgId}/teams/`}
      >
        {t('Join a Team')}
      </Button>
    );

    const createProjectAction = (
      <Button
        title={
          canCreateProject
            ? undefined
            : t('You do not have permission to create a project.')
        }
        disabled={!canCreateProject}
        priority={orgHasProjects ? 'default' : 'primary'}
        to={`/organizations/${orgId}/projects/new/`}
      >
        {t('Create project')}
      </Button>
    );

    return (
      <Wrapper>
        <HeightWrapper>
          <img src={img} height={350} alt="Nothing to see" />
          <Content>
            <StyledPageHeading>{t('Remain Calm')}</StyledPageHeading>
            <HelpMessage>
              {t('You need at least one project to use this view')}
            </HelpMessage>
            <Actions gap={1}>
              {!orgHasProjects ? (
                createProjectAction
              ) : (
                <React.Fragment>
                  {joinTeamAction}
                  {createProjectAction}
                </React.Fragment>
              )}
            </Actions>
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

const Actions = styled(ButtonBar)`
  width: fit-content;
`;
