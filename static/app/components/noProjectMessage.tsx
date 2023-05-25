import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NoProjectEmptyState from 'sentry/components/illustrations/NoProjectEmptyState';
import * as Layout from 'sentry/components/layouts/thirds';
import {useProjectCreationAccess} from 'sentry/components/projects/useProjectCreationAccess';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  organization: Organization;
  children?: React.ReactNode;
  superuserNeedsToBeProjectMember?: boolean;
};

function NoProjectMessage({
  children,
  organization,
  superuserNeedsToBeProjectMember,
}: Props) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const orgSlug = organization.slug;
  const {canCreateProject} = useProjectCreationAccess(organization);
  const canJoinTeam = organization.access.includes('team:read');

  const {isSuperuser} = ConfigStore.get('user');

  const orgHasProjects = !!projects?.length;
  const hasProjectAccess =
    isSuperuser && !superuserNeedsToBeProjectMember
      ? !!projects?.some(p => p.hasAccess)
      : !!projects?.some(p => p.isMember && p.hasAccess);

  if (hasProjectAccess || !projectsLoaded) {
    return <Fragment>{children}</Fragment>;
  }

  // If the organization has some projects, but the user doesn't have access to
  // those projects, the primary action is to Join a Team. Otherwise the primary
  // action is to create a project.

  const joinTeamAction = (
    <Button
      title={canJoinTeam ? undefined : t('You do not have permission to join a team.')}
      disabled={!canJoinTeam}
      priority={orgHasProjects ? 'primary' : 'default'}
      to={`/settings/${orgSlug}/teams/`}
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
      to={`/organizations/${orgSlug}/projects/new/`}
    >
      {t('Create project')}
    </Button>
  );

  return (
    <Wrapper>
      <NoProjectEmptyState />

      <Content>
        <Layout.Title>{t('Remain Calm')}</Layout.Title>
        <HelpMessage>{t('You need at least one project to use this view')}</HelpMessage>
        <Actions gap={1}>
          {!orgHasProjects ? (
            createProjectAction
          ) : (
            <Fragment>
              {joinTeamAction}
              {createProjectAction}
            </Fragment>
          )}
        </Actions>
      </Content>
    </Wrapper>
  );
}

export default NoProjectMessage;

const HelpMessage = styled('div')`
  margin-bottom: ${space(2)};
`;

const Wrapper = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-left: 40px;
`;

const Actions = styled(ButtonBar)`
  width: fit-content;
`;
