import {Fragment, useCallback, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
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

import GenericFooter from '../genericFooter';

import {useHeartbeat} from './useHeartbeat';

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

  const {
    loading,
    firstErrorReceived,
    firstTransactionReceived,
    sessionReceived,
    serverConnected,
  } = useHeartbeat(project?.slug, project?.id);

  useEffect(() => {
    if (loading || !serverConnected) {
      return;
    }

    addSuccessMessage(t('SDK Connected'));
  }, [serverConnected, loading]);

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
    if (loading || !firstErrorReceived) {
      return;
    }

    trackAdvancedAnalyticsEvent('heartbeat.onboarding_first_error_received', {
      organization,
      new_organization: !!newOrg,
    });

    addSuccessMessage(t('First error received'));
  }, [firstErrorReceived, loading, newOrg, organization]);

  useEffect(() => {
    const onUnload = (nextLocation?: Location) => {
      if (location.pathname.startsWith('onboarding')) {
        return true;
      }

      if (!serverConnected) {
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
  }, [router, route, organization, firstErrorReceived, serverConnected]);

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

    if (!firstErrorReceived) {
      openChangeRouteModal(router, nextLocation);
      return;
    }

    router.push(nextLocation);
  }, [router, organization, project, firstErrorReceived]);

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
        {loading ? (
          <Fragment>
            <LoadingPlaceholder height="28px" width="160px" />
            <LoadingPlaceholder height="28px" width="160px" />
          </Fragment>
        ) : firstErrorReceived ? (
          <Fragment>
            <Beat status={BeatStatus.COMPLETE}>
              <IconCheckmark size="sm" isCircled />
              {t('DSN response received')}
            </Beat>
            <Beat status={BeatStatus.COMPLETE}>
              <IconCheckmark size="sm" isCircled />
              {t('First error received')}
            </Beat>
          </Fragment>
        ) : serverConnected ? (
          <Fragment>
            <Beat status={BeatStatus.COMPLETE}>
              <IconCheckmark size="sm" isCircled />
              {t('DSN response received')}
            </Beat>
            <Beat status={BeatStatus.AWAITING}>
              <PulsingIndicator>2</PulsingIndicator>
              {t('Awaiting first error')}
            </Beat>
          </Fragment>
        ) : (
          <Fragment>
            <Beat status={BeatStatus.AWAITING}>
              <PulsingIndicator>1</PulsingIndicator>
              {t('Awaiting DSN response')}
            </Beat>
            <Beat status={BeatStatus.PENDING}>
              <PulsingIndicator>2</PulsingIndicator>
              {t('Awaiting first error')}
            </Beat>
          </Fragment>
        )}
      </Beats>
      <Actions>
        <ButtonBar gap={1}>
          {newOrg ? (
            <Fragment>
              {loading ? (
                <LoadingPlaceholderButton width="135px" />
              ) : firstErrorReceived ? (
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
                  onClick={() => {
                    trackAdvancedAnalyticsEvent(
                      'heartbeat.onboarding_go_to_my_error_button_clicked',
                      {
                        organization,
                        new_organization: !!newOrg,
                      }
                    );
                  }}
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
                  onClick={() => {
                    trackAdvancedAnalyticsEvent(
                      'heartbeat.onboarding_go_to_my_error_button_clicked',
                      {
                        organization,
                        new_organization: !!newOrg,
                      }
                    );
                  }}
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

const Wrapper = styled(GenericFooter)<{newOrg: boolean; sidebarCollapsed: boolean}>`
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

const LoadingPlaceholderButton = styled(LoadingPlaceholder)`
  height: ${p => p.theme.form.md.height}px;
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
