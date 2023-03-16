import {useCallback, useContext, useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark, IconCircle, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Group, OnboardingStatus, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import {usePersistedOnboardingState} from 'sentry/views/onboarding/utils';

export type OnboardingState = {
  status: OnboardingStatus;
  firstIssueId?: string;
};

const DEFAULT_POLL_INTERVAL = 5000;

type Props = Pick<RouteComponentProps<{}, {}>, 'router' | 'route' | 'location'> & {
  projectSlug: Project['slug'];
  newOrg?: boolean;
  projectId?: Project['id'];
};

async function openChangeRouteModal({
  clientState,
  nextLocation,
  router,
  setClientState,
}: {
  clientState: ReturnType<typeof usePersistedOnboardingState>[0];
  nextLocation: Location;
  router: RouteComponentProps<{}, {}>['router'];
  setClientState: ReturnType<typeof usePersistedOnboardingState>[1];
}) {
  const mod = await import('sentry/components/onboarding/changeRouteModal');

  const {ChangeRouteModal} = mod;

  openModal(deps => (
    <ChangeRouteModal
      {...deps}
      router={router}
      nextLocation={nextLocation}
      clientState={clientState}
      setClientState={setClientState}
    />
  ));
}

export function Footer({projectSlug, projectId, router, newOrg}: Props) {
  const organization = useOrganization();
  const preferences = useLegacyStore(PreferencesStore);
  const [firstError, setFirstError] = useState<string | null>(null);
  const [firstIssue, setFirstIssue] = useState<Group | undefined>(undefined);
  const [clientState, setClientState] = usePersistedOnboardingState();
  const {projects} = useProjects();
  const onboardingContext = useContext(OnboardingContext);
  const projectData = projectId ? onboardingContext.data[projectId] : undefined;
  const selectedProject = projects.find(project => project.slug === projectSlug);

  useQuery<Project>([`/projects/${organization.slug}/${projectSlug}/`], {
    staleTime: 0,
    refetchInterval: DEFAULT_POLL_INTERVAL,
    enabled:
      !!projectSlug && !firstError && projectData?.status === OnboardingStatus.WAITING, // Fetch only if the project is available and we have not yet received an error,
    onSuccess: data => {
      setFirstError(data.firstEvent);
    },
  });

  // Locate the projects first issue group. The project.firstEvent field will
  // *not* include sample events, while just looking at the issues list will.
  // We will wait until the project.firstEvent is set and then locate the
  // event given that event datetime
  useQuery<Group[]>([`/projects/${organization.slug}/${projectSlug}/issues/`], {
    staleTime: 0,
    enabled:
      !!firstError && !firstIssue && projectData?.status === OnboardingStatus.PROCESSING, // Only fetch if an error event is received and we have not yet located the first issue,
    onSuccess: data => {
      setFirstIssue(data.find((issue: Group) => issue.firstSeen === firstError));
    },
  });

  useEffect(() => {
    if (!projectId || !!projectData) {
      return;
    }

    onboardingContext.setProjectData({
      projectId,
      projectSlug,
      status: OnboardingStatus.WAITING,
    });
  }, [projectData, onboardingContext, projectSlug, projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (!firstError) {
      return;
    }

    if (projectData?.status !== OnboardingStatus.WAITING) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.first_error_received', {
      organization,
      new_organization: !!newOrg,
      project_id: projectId,
      platform: selectedProject?.platform ?? 'other',
    });

    onboardingContext.setProjectData({
      projectId,
      projectSlug,
      status: OnboardingStatus.PROCESSING,
    });

    addSuccessMessage(t('First error received'));
  }, [
    firstError,
    newOrg,
    organization,
    projectId,
    projectData,
    onboardingContext,
    projectSlug,
    selectedProject,
  ]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (!firstIssue) {
      return;
    }

    if (projectData?.status !== OnboardingStatus.PROCESSING) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.first_error_processed', {
      organization,
      new_organization: !!newOrg,
      project_id: projectId,
      platform: selectedProject?.platform ?? 'other',
    });

    onboardingContext.setProjectData({
      projectId,
      projectSlug,
      status: OnboardingStatus.PROCESSED,
      firstIssueId: firstIssue.id,
    });

    addSuccessMessage(t('First error processed'));
  }, [
    firstIssue,
    newOrg,
    organization,
    projectData,
    projectId,
    onboardingContext,
    projectSlug,
    selectedProject,
  ]);

  // The explore button is only showed if Sentry has not yet received any errors OR the issue is still being processed
  const handleExploreSentry = useCallback(() => {
    if (!projectId) {
      return;
    }

    if (onboardingContext.data[projectId].status === OnboardingStatus.WAITING) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.explore_sentry_button_clicked', {
      organization,
      project_id: projectId,
      platform: selectedProject?.platform ?? 'other',
    });

    if (clientState) {
      setClientState({
        ...clientState,
        state: 'finished',
      });
    }

    router.push({
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/?referrer=onboarding-first-event-footer`,
    });
  }, [
    organization,
    projectId,
    onboardingContext,
    clientState,
    router,
    setClientState,
    selectedProject,
  ]);

  const handleSkipOnboarding = useCallback(() => {
    if (!projectId) {
      return;
    }

    if (onboardingContext.data[projectId].status !== OnboardingStatus.WAITING) {
      return;
    }

    trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
      organization,
      source: 'targeted_onboarding_first_event_footer',
    });

    const selectedProjectId = selectedProject?.id;

    let pathname = `/organizations/${organization.slug}/issues/?`;
    if (selectedProjectId) {
      pathname += `project=${selectedProjectId}&`;
    }

    openChangeRouteModal({
      router,
      nextLocation: {
        ...router.location,
        pathname: (pathname += `referrer=onboarding-first-event-footer-skip`),
      },
      setClientState,
      clientState,
    });
  }, [
    router,
    organization,
    setClientState,
    clientState,
    selectedProject,
    onboardingContext,
    projectId,
  ]);

  const handleViewError = useCallback(() => {
    if (!projectId) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.view_error_button_clicked', {
      organization,
      new_organization: !!newOrg,
      project_id: projectId,
      platform: selectedProject?.platform ?? 'other',
    });

    if (clientState) {
      setClientState({
        ...clientState,
        state: 'finished',
      });
    }

    router.push({
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/${onboardingContext.data[projectId].firstIssueId}/?referrer=onboarding-first-event-footer`,
    });
  }, [
    organization,
    newOrg,
    router,
    clientState,
    setClientState,
    onboardingContext,
    projectId,
    selectedProject,
  ]);

  return (
    <Wrapper newOrg={!!newOrg} sidebarCollapsed={!!preferences.collapsed}>
      <Column>
        {projectData?.status === OnboardingStatus.WAITING && newOrg && (
          <Button onClick={handleSkipOnboarding} priority="link">
            {t('Skip Onboarding')}
          </Button>
        )}
      </Column>
      <StatusesColumn>
        {projectData?.status === OnboardingStatus.WAITING ? (
          <WaitingForErrorStatus>
            <IconCircle size="sm" />
            {t('Waiting for error')}
          </WaitingForErrorStatus>
        ) : projectData?.status === OnboardingStatus.PROCESSED ? (
          <ErrorProcessedStatus>
            <IconCheckmark isCircled size="sm" color="green300" />
            {t('Error Processed!')}
          </ErrorProcessedStatus>
        ) : (
          <ErrorProcessingStatus>
            <RefreshIcon size="sm" />
            {t('Processing error')}
          </ErrorProcessingStatus>
        )}
      </StatusesColumn>
      <ActionsColumn>
        {projectData?.status === OnboardingStatus.PROCESSED ? (
          <Button priority="primary" onClick={handleViewError}>
            {t('View Error')}
          </Button>
        ) : (
          <Button
            priority="primary"
            disabled={projectData?.status === OnboardingStatus.WAITING}
            onClick={handleExploreSentry}
            title={
              projectData?.status === OnboardingStatus.WAITING
                ? t('Waiting for error')
                : undefined
            }
          >
            {t('Explore Sentry')}
          </Button>
        )}
      </ActionsColumn>
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
  padding: ${space(2)} ${space(4)};
  justify-content: space-between;
  align-items: center;

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

const Column = styled('div')`
  display: flex;
`;

const StatusesColumn = styled('div')`
  display: flex;
  justify-content: center;
`;

const ActionsColumn = styled('div')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    justify-content: flex-end;
  }
`;

const WaitingForErrorStatus = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(0.75)};
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  border: 1.5px solid ${p => p.theme.gray500};
  border-radius: 76px;
  color: ${p => p.theme.gray500};
  line-height: ${p => p.theme.fontSizeLarge};
`;

const ErrorProcessingStatus = styled(WaitingForErrorStatus)`
  border-color: ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  position: relative;

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
`;

const ErrorProcessedStatus = styled(WaitingForErrorStatus)`
  border-radius: 44px;
  background: ${p => p.theme.inverted.background};
  color: ${p => p.theme.inverted.textColor};
`;

const RefreshIcon = styled(IconRefresh)`
  animation: rotate 1s linear infinite;
`;
