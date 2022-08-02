import {Fragment} from 'react';
import styled from '@emotion/styled';

/* TODO: replace with I/O when finished */
import img from 'sentry-images/spot/hair-on-fire.svg';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import PageHeading from 'sentry/components/pageHeading';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
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
  const canCreateProject = organization.access.includes('project:write');
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
      <HeightWrapper>
        <img src={img} height={350} alt={t('Nothing to see')} />
        <Content>
          <StyledPageHeading>{t('Remain Calm')}</StyledPageHeading>
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
      </HeightWrapper>
    </Wrapper>
  );
}

const StyledPageHeading = styled(PageHeading)`
  font-size: 28px;
  margin-bottom: ${space(1.5)};
`;

const HelpMessage = styled('div')`
  margin-bottom: ${space(2)};
`;

const Wrapper = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const HeightWrapper = styled('div')`
  display: flex;
  height: 350px;
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

export default NoProjectMessage;
