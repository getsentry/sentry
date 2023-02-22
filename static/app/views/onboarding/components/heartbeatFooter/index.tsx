import {Fragment, useCallback, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import IdBadge from 'sentry/components/idBadge';
import Placeholder from 'sentry/components/placeholder';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

import GenericFooter from '../genericFooter';

import {useHeartbeat} from './useHeartbeat';

type HeartbeatState = {
  beats: {
    firstErrorReceived: boolean | string;
    sdkConnected: boolean;
  };
};

enum BeatStatus {
  AWAITING = 'awaiting',
  PENDING = 'pending',
  COMPLETE = 'complete',
}

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
};

export function HeartbeatFooter({projectSlug, router, route, newOrg}: Props) {
  const organization = useOrganization();
  const preferences = useLegacyStore(PreferencesStore);

  const {initiallyLoaded, fetchError, fetching, projects} = useProjects({
    orgId: organization.id,
    slugs: [projectSlug],
  });

  const projectsLoading = !initiallyLoaded && fetching;

  const project =
    !projectsLoading && !fetchError && projects.length
      ? projects.find(proj => proj.slug === projectSlug)
      : undefined;

  const heartbeat_sessionStorage_key = `heartbeat-${project?.slug}`;

  const [sessionStorage, setSessionStorage] = useSessionStorage<HeartbeatState>(
    heartbeat_sessionStorage_key,
    {
      beats: {
        sdkConnected: false,
        firstErrorReceived: false,
      },
    }
  );

  const {
    loading,
    issuesLoading,
    firstErrorReceived,
    firstTransactionReceived,
    sessionReceived,
    serverConnected,
  } = useHeartbeat(project?.slug, project?.id);

  useEffect(() => {
    if (loading || !sessionReceived) {
      return;
    }

    trackAdvancedAnalyticsEvent('heartbeat.onboarding_session_received', {
      organization,
      new_organization: !!newOrg,
    });
  }, [sessionReceived, loading, newOrg, organization]);

  useEffect(() => {
    if (loading || !firstTransactionReceived) {
      return;
    }

    trackAdvancedAnalyticsEvent('heartbeat.onboarding_first_transaction_received', {
      organization,
      new_organization: !!newOrg,
    });
  }, [firstTransactionReceived, loading, newOrg, organization]);

  useEffect(() => {
    if (loading || !serverConnected || !!sessionStorage?.beats?.sdkConnected) {
      return;
    }

    setSessionStorage({
      ...sessionStorage,
      beats: {...sessionStorage.beats, sdkConnected: true},
    });

    addSuccessMessage(t('SDK Connected'));
  }, [serverConnected, loading, sessionStorage, setSessionStorage]);

  useEffect(() => {
    if (
      loading ||
      issuesLoading ||
      !firstErrorReceived ||
      !!sessionStorage?.beats?.firstErrorReceived
    ) {
      return;
    }

    trackAdvancedAnalyticsEvent('heartbeat.onboarding_first_error_received', {
      organization,
      new_organization: !!newOrg,
    });

    const firstErrorOrTrue =
      firstErrorReceived !== true && 'id' in firstErrorReceived
        ? firstErrorReceived.id
        : true;

    setSessionStorage({
      ...sessionStorage,
      beats: {...sessionStorage.beats, firstErrorReceived: firstErrorOrTrue},
    });

    addSuccessMessage(t('First error received'));
  }, [
    firstErrorReceived,
    issuesLoading,
    loading,
    newOrg,
    organization,
    sessionStorage,
    setSessionStorage,
  ]);

  useEffect(() => {
    const onUnload = (nextLocation?: Location) => {
      if (location.pathname.startsWith('onboarding')) {
        return true;
      }

      // If the user has not yet started with the onboarding, then we don't show the dialog
      if (!sessionStorage.beats.sdkConnected) {
        return true;
      }

      // If the user has already sent an error, then we don't show the dialog
      if (sessionStorage.beats.firstErrorReceived) {
        return true;
      }

      // Next Location is always available when user clicks on a item with a new route
      if (!nextLocation) {
        return true;
      }

      if (nextLocation.query.setUpRemainingOnboardingTasksLater) {
        return true;
      }

      // If users are in the onboarding of existing orgs &&
      // have started the SDK instrumentation &&
      // clicks elsewhere else to change the route,
      // then we display the 'are you sure?' dialog.
      openChangeRouteModal(router, nextLocation);

      return false;
    };

    router.setRouteLeaveHook(route, onUnload);
  }, [
    router,
    route,
    organization,
    sessionStorage.beats.sdkConnected,
    sessionStorage.beats.firstErrorReceived,
  ]);

  // The explore button is only showed if Sentry has not yet received any errors.
  const handleExploreSentry = useCallback(() => {
    trackAdvancedAnalyticsEvent('heartbeat.onboarding_explore_sentry_button_clicked', {
      organization,
    });

    openChangeRouteModal(router, {
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/`,
    });
  }, [router, organization]);

  // This button will go away in the next iteration, but
  // basically now it will display the 'are you sure?' dialog only
  // if Sentry has not yet received any errors.
  const handleGoToPerformance = useCallback(() => {
    trackAdvancedAnalyticsEvent('heartbeat.onboarding_go_to_performance_button_clicked', {
      organization,
    });

    const nextLocation: Location = {
      ...router.location,
      pathname: `/organizations/${organization.slug}/performance/`,
      query: {project: project?.id},
    };

    if (sessionStorage.beats.firstErrorReceived) {
      router.push(nextLocation);
      return;
    }

    openChangeRouteModal(router, nextLocation);
  }, [router, organization, project, sessionStorage.beats.firstErrorReceived]);

  // It's the same idea as the explore button and this will go away in the next iteration.
  const handleGoToIssues = useCallback(() => {
    trackAdvancedAnalyticsEvent('heartbeat.onboarding_go_to_issues_button_clicked', {
      organization,
    });

    openChangeRouteModal(router, {
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {project: project?.id},
      hash: '#welcome',
    });
  }, [router, organization, project]);

  const handleGoToMyError = useCallback(() => {
    if (projectsLoading) {
      return;
    }

    trackAdvancedAnalyticsEvent('heartbeat.onboarding_go_to_my_error_button_clicked', {
      organization,
      new_organization: !!newOrg,
    });

    if (typeof sessionStorage.beats.firstErrorReceived !== 'boolean') {
      router.push({
        ...router.location,
        pathname: `/organizations/${organization.slug}/issues/${sessionStorage.beats.firstErrorReceived}/?referrer=onboarding-first-event-footer`,
      });
      return;
    }

    router.push({
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/?referrer=onboarding-first-event-footer`,
    });
  }, [
    projectsLoading,
    organization,
    newOrg,
    router,
    sessionStorage.beats.firstErrorReceived,
  ]);

  return (
    <Wrapper newOrg={!!newOrg} sidebarCollapsed={!!preferences.collapsed}>
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
      <Beats>
        {sessionStorage.beats.sdkConnected ? (
          <Beat status={BeatStatus.COMPLETE}>
            <IconCheckmark size="sm" isCircled />
            {t('SDK Connected')}
          </Beat>
        ) : loading ? (
          <LoadingPlaceholder height="28px" width="160px" />
        ) : (
          <Beat status={BeatStatus.AWAITING}>
            <PulsingIndicator>1</PulsingIndicator>
            {t('Awaiting SDK connection')}
          </Beat>
        )}
        {sessionStorage.beats.firstErrorReceived ? (
          <Beat status={BeatStatus.COMPLETE}>
            <IconCheckmark size="sm" isCircled />
            {t('First error received')}
          </Beat>
        ) : loading ? (
          <LoadingPlaceholder height="28px" width="160px" />
        ) : (
          <Beat status={BeatStatus.AWAITING}>
            <PulsingIndicator>2</PulsingIndicator>
            {t('Awaiting first error')}
          </Beat>
        )}
      </Beats>
      <Actions>
        <ButtonBar gap={1}>
          {newOrg ? (
            <Fragment>
              {sessionStorage.beats.firstErrorReceived &&
              typeof sessionStorage.beats.firstErrorReceived !== 'boolean' ? (
                <Button
                  priority="primary"
                  busy={projectsLoading}
                  onClick={handleGoToMyError}
                >
                  {t('Go to my error')}
                </Button>
              ) : (
                <Button
                  priority="primary"
                  busy={projectsLoading}
                  onClick={handleExploreSentry}
                >
                  {t('Explore Sentry')}
                </Button>
              )}
            </Fragment>
          ) : (
            <Fragment>
              <Button busy={projectsLoading} onClick={handleGoToPerformance}>
                {t('Go to Performance')}
              </Button>
              {sessionStorage.beats.firstErrorReceived &&
              typeof sessionStorage.beats.firstErrorReceived !== 'boolean' ? (
                <Button
                  priority="primary"
                  busy={projectsLoading}
                  onClick={handleGoToMyError}
                >
                  {t('Go to my error')}
                </Button>
              ) : (
                <Button
                  priority="primary"
                  busy={projectsLoading}
                  onClick={handleGoToIssues}
                >
                  {t('Go to Issues')}
                </Button>
              )}
            </Fragment>
          )}
        </ButtonBar>
      </Actions>
    </Wrapper>
  );
}

const Wrapper = styled(GenericFooter, {
  shouldForwardProp: prop => isPropValid(prop),
})<{
  newOrg: boolean;
  sidebarCollapsed: boolean;
}>`
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
  ${p =>
    !p.newOrg &&
    css`
      @media (min-width: ${p.theme.breakpoints.medium}) {
        width: calc(
          100% -
            ${p.theme.sidebar[p.sidebarCollapsed ? 'collapsedWidth' : 'expandedWidth']}
        );
        right: 0;
        left: auto;
      }
    `}
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

const Beats = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    gap: ${space(2)};
    display: grid;
    grid-template-columns: repeat(2, max-content);
    justify-content: center;
    align-items: center;
  }
`;

const LoadingPlaceholder = styled(Placeholder)`
  width: ${p => p.width ?? '100%'};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.white};
  height: 16px;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  :before {
    top: auto;
    left: auto;
  }
`;

const Beat = styled('div')<{status: BeatStatus}>`
  width: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.pink300};

  ${p =>
    p.status === BeatStatus.PENDING &&
    css`
      color: ${p.theme.disabled};
      ${PulsingIndicator} {
        background: ${p.theme.disabled};
        :before {
          content: none;
        }
      }
    `}

  ${p =>
    p.status === BeatStatus.COMPLETE &&
    css`
      color: ${p.theme.successText};
      ${PulsingIndicator} {
        background: ${p.theme.success};
        :before {
          content: none;
        }
      }
    `}
`;

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
