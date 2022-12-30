import {useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import getPlatformName from 'sentry/utils/getPlatformName';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import GenericFooter from '../genericFooter';

import {Beats, LoadingPlaceholder} from './beats';
import {useHeartbeat} from './useHeartbeat';

async function openChangeRouteModal(
  router: RouteComponentProps<{}, {}>['router'],
  nextLocation: Location
) {
  const mod = await import(
    'sentry/views/onboarding/components/heartbeatFooter/changeRouteModal'
  );
  const {ChangeRouteModal} = mod;

  openModal(deps => (
    <ChangeRouteModal {...deps} router={router} nextLocation={nextLocation} />
  ));
}

type Props = Pick<RouteComponentProps<{}, {}>, 'router' | 'route' | 'location'> & {
  projectSlug: Project['slug'];
  newOrg?: boolean;
  nextProjectSlug?: Project['slug'];
  onSetupNextProject?: () => void;
};

export function HeartbeatFooter({
  projectSlug,
  router,
  route,
  location,
  newOrg,
  nextProjectSlug,
  onSetupNextProject,
}: Props) {
  const organization = useOrganization();
  const preferences = useLegacyStore(PreferencesStore);

  const {initiallyLoaded, fetchError, fetching, projects} = useProjects({
    orgId: organization.id,
    slugs: nextProjectSlug ? [projectSlug, nextProjectSlug] : [projectSlug],
  });

  const projectsLoading = !initiallyLoaded && fetching;

  const project =
    !projectsLoading && !fetchError && projects.length
      ? projects.find(proj => proj.slug === projectSlug)
      : undefined;

  const nextProject =
    !projectsLoading && !fetchError && projects.length === 2
      ? projects.find(proj => proj.slug === nextProjectSlug)
      : undefined;

  const {
    sessionLoading,
    eventLoading,
    firstErrorReceived,
    firstTransactionReceived,
    sessionInProgress,
  } = useHeartbeat({project});

  const serverConnected = sessionInProgress || firstTransactionReceived;

  useEffect(() => {
    const onUnload = (nextLocation?: Location) => {
      const {orgId, platform, projectId} = router.params;

      const isSetupDocsForNewOrg =
        location.pathname === `/onboarding/${organization.slug}/setup-docs/` &&
        nextLocation?.pathname !== `/onboarding/${organization.slug}/setup-docs/`;

      const isSetupDocsForNewOrgBackButton = `/onboarding/${organization.slug}/select-platform/`;

      const isGettingStartedForExistingOrg =
        location.pathname === `/${orgId}/${projectId}/getting-started/${platform}/` ||
        location.pathname === `/organizations/${orgId}/${projectId}/getting-started/`;

      if (isSetupDocsForNewOrg || isGettingStartedForExistingOrg) {
        // TODO(Priscila): I have to adjust this to check for all selected projects in the onboarding of new orgs
        if (serverConnected && firstErrorReceived) {
          return true;
        }

        // Next Location is always available when user clicks on a item with a new route
        if (nextLocation) {
          // Back button in the onboarding of new orgs
          if (nextLocation.pathname === isSetupDocsForNewOrgBackButton) {
            return true;
          }

          if (nextLocation.query.setUpRemainingOnboardingTasksLater) {
            return true;
          }

          openChangeRouteModal(router, nextLocation);
          return false;
        }

        return true;
      }

      return true;
    };

    router.setRouteLeaveHook(route, onUnload);
  }, [serverConnected, firstErrorReceived, route, router, organization.slug, location]);

  const platformIconAndName = (
    <PlatformIconAndName>
      {projectsLoading ? (
        <LoadingPlaceholder height="28px" width="276px" />
      ) : (
        <IdBadge
          project={project}
          displayPlatformName
          avatarSize={28}
          hideOverflow
          disableLink
        />
      )}
    </PlatformIconAndName>
  );

  const beats = (
    <Beats
      loading={projectsLoading || sessionLoading || eventLoading}
      firstErrorReceived={firstErrorReceived}
      serverConnected={serverConnected}
    />
  );

  if (newOrg) {
    return (
      <NewOrgWrapper>
        {platformIconAndName}
        {beats}
        <Actions>
          <ButtonBar gap={1}>
            {nextProject && (
              <Button busy={projectsLoading} onClick={onSetupNextProject}>
                {nextProject.platform
                  ? t('Setup %s', getPlatformName(nextProject.platform))
                  : t('Next Platform')}
              </Button>
            )}
            {firstErrorReceived ? (
              <Button
                priority="primary"
                busy={projectsLoading}
                to={`/organizations/${organization.slug}/issues/${
                  firstErrorReceived &&
                  firstErrorReceived !== true &&
                  'id' in firstErrorReceived
                    ? `${firstErrorReceived.id}/`
                    : ''
                }?referrer=onboarding-first-event-footer`}
              >
                {t('Go to my error')}
              </Button>
            ) : (
              <Button
                priority="primary"
                busy={projectsLoading}
                to={`/organizations/${organization.slug}/issues/`} // TODO(Priscila): See what Jesse meant with 'explore sentry'. What should be the expected action?
              >
                {t('Explore Sentry')}
              </Button>
            )}
          </ButtonBar>
        </Actions>
      </NewOrgWrapper>
    );
  }

  return (
    <ExistingOrgWrapper sidebarCollapsed={!!preferences.collapsed}>
      {platformIconAndName}
      {beats}
      <Actions>
        <ButtonBar gap={1}>
          <Button
            busy={projectsLoading}
            to={{
              pathname: `/organizations/${organization.slug}/performance/`,
              query: {project: project?.id},
            }}
          >
            {t('Go to Performance')}
          </Button>
          {firstErrorReceived ? (
            <Button
              priority="primary"
              busy={projectsLoading}
              to={`/organizations/${organization.slug}/issues/${
                firstErrorReceived &&
                firstErrorReceived !== true &&
                'id' in firstErrorReceived
                  ? `${firstErrorReceived.id}/`
                  : ''
              }`}
            >
              {t('Go to my error')}
            </Button>
          ) : (
            <Button
              priority="primary"
              busy={projectsLoading}
              to={{
                pathname: `/organizations/${organization.slug}/issues/`,
                query: {project: project?.id},
                hash: '#welcome',
              }}
            >
              {t('Go to Issues')}
            </Button>
          )}
        </ButtonBar>
      </Actions>
    </ExistingOrgWrapper>
  );
}

const NewOrgWrapper = styled(GenericFooter)`
  display: none;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  padding: ${space(2)} ${space(4)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
    gap: ${space(3)};
  }
`;

const ExistingOrgWrapper = styled(NewOrgWrapper)<{sidebarCollapsed: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: calc(
      100% -
        ${p => p.theme.sidebar[p.sidebarCollapsed ? 'collapsedWidth' : 'expandedWidth']}
    );
    right: 0;
    left: auto;
  }
`;

const PlatformIconAndName = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 100%;
    overflow: hidden;
    width: 100%;
    display: block;
  }
`;

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
