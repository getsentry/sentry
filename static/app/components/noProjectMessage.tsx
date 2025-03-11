import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NoProjectEmptyState from 'sentry/components/illustrations/NoProjectEmptyState';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

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
  const user = useUser();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const orgSlug = organization.slug;
  const canUserCreateProject = useCanCreateProject();
  const canJoinTeam = organization.access.includes('team:read');

  const orgHasProjects = !!projects?.length;
  const hasProjectAccess =
    user.isSuperuser && !superuserNeedsToBeProjectMember
      ? !!projects?.some(p => p.hasAccess)
      : !!projects?.some(p => p.isMember && p.hasAccess);

  if (hasProjectAccess || !projectsLoaded) {
    return <Fragment>{children}</Fragment>;
  }

  // If the organization has some projects, but the user doesn't have access to
  // those projects, the primary action is to Join a Team. Otherwise the primary
  // action is to create a project.

  const joinTeamAction = (
    <LinkButton
      title={canJoinTeam ? undefined : t('You do not have permission to join a team.')}
      disabled={!canJoinTeam}
      priority={orgHasProjects ? 'primary' : 'default'}
      to={`/settings/${orgSlug}/teams/`}
    >
      {t('Join a Team')}
    </LinkButton>
  );

  const createProjectAction = (
    <LinkButton
      title={
        canUserCreateProject
          ? undefined
          : t('You do not have permission to create a project.')
      }
      disabled={!canUserCreateProject}
      priority={orgHasProjects ? 'default' : 'primary'}
      to={`/organizations/${orgSlug}/projects/new/`}
    >
      {t('Create project')}
    </LinkButton>
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
