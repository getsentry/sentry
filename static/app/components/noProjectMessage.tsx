import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ButtonBar, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import NoProjectEmptyState from 'sentry/components/illustrations/NoProjectEmptyState';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

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
      to={`/settings/${organization.slug}/teams/`}
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
      to={makeProjectsPathname({path: '/new/', organization})}
    >
      {t('Create project')}
    </LinkButton>
  );

  return (
    <Flex
      flex="1"
      align="center"
      justify="center"
      gap="3xl"
      padding="lg"
      direction={{xs: 'column', sm: 'row'}}
    >
      <Flex
        align="center"
        justify="center"
        height="auto"
        width={{xs: '300px', sm: 'auto'}}
      >
        <StyledNoProjectEmptyState />
      </Flex>

      <Flex direction="column" justify="center">
        <Layout.Title>{t('Remain Calm')}</Layout.Title>
        <HelpMessage>{t('You need at least one project to use this view')}</HelpMessage>
        <Actions>
          {orgHasProjects ? (
            <Fragment>
              {joinTeamAction}
              {createProjectAction}
            </Fragment>
          ) : (
            createProjectAction
          )}
        </Actions>
      </Flex>
    </Flex>
  );
}

export default NoProjectMessage;

const StyledNoProjectEmptyState = styled(NoProjectEmptyState)`
  width: 100%;
  height: auto;
`;

const HelpMessage = styled('div')`
  margin-bottom: ${space(2)};
`;

const Actions = styled(ButtonBar)`
  width: fit-content;
`;
