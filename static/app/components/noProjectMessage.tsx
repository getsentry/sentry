import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Container} from '@sentry/scraps/layout';

import {NoProjectEmptyState} from 'sentry/components/illustrations/NoProjectEmptyState';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useProjects} from 'sentry/utils/useProjects';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type Props = {
  organization: Organization;
  as?: 'main';
  children?: React.ReactNode;
  requireProjectMembership?: boolean;
  superuserNeedsToBeProjectMember?: boolean;
};

export function NoProjectMessage({
  as,
  children,
  organization,
  requireProjectMembership,
  superuserNeedsToBeProjectMember,
}: Props) {
  const {projects} = useProjects();
  const {hasProjectAccess, projectsLoaded} = useHasProjectAccess({
    requireProjectMembership,
    superuserNeedsToBeProjectMember,
  });

  const canUserCreateProject = useCanCreateProject();
  const canJoinTeam = organization.access.includes('team:read');

  const orgHasProjects = !!projects?.length;

  if (hasProjectAccess || !projectsLoaded) {
    return <Fragment>{children}</Fragment>;
  }

  // If the organization has some projects, but the user doesn't have access to
  // those projects, the primary action is to Join a Team. Otherwise the primary
  // action is to create a project.

  const joinTeamAction = (
    <LinkButton
      tooltipProps={{
        title: canJoinTeam ? undefined : t('You do not have permission to join a team.'),
      }}
      disabled={!canJoinTeam}
      variant={orgHasProjects ? 'primary' : 'secondary'}
      to={`/settings/${organization.slug}/teams/`}
    >
      {t('Join a Team')}
    </LinkButton>
  );

  const createProjectAction = (
    <LinkButton
      tooltipProps={{
        title: canUserCreateProject
          ? undefined
          : t('You do not have permission to create a project.'),
      }}
      disabled={!canUserCreateProject}
      variant={orgHasProjects ? 'secondary' : 'primary'}
      to={makeProjectsPathname({path: '/new/', organization})}
    >
      {t('Create project')}
    </LinkButton>
  );

  const emptyState = (
    <EmptyState
      flex="1"
      justify="center"
      gap="3xl"
      padding="lg"
      title={t('Remain Calm')}
      description={t('You need at least one project to use this view')}
      illustration={
        <Container width={{zero: '300px', xl: '480px', '4xl': '683px'}}>
          <StyledNoProjectEmptyState />
        </Container>
      }
      action={
        <Fragment>
          {orgHasProjects ? (
            <Fragment>
              {joinTeamAction}
              {createProjectAction}
            </Fragment>
          ) : (
            createProjectAction
          )}
        </Fragment>
      }
    />
  );

  return as ? (
    <Container as={as} display="flex" flexGrow={1}>
      {emptyState}
    </Container>
  ) : (
    emptyState
  );
}

const StyledNoProjectEmptyState = styled(NoProjectEmptyState)`
  width: 100%;
  height: auto;
`;
