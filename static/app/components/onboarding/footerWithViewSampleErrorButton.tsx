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
import {Group, OnboardingProjectStatus, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';

export type OnboardingState = {
  status: OnboardingProjectStatus;
  firstIssueId?: string;
};

const DEFAULT_POLL_INTERVAL = 5000;

type Props = Pick<RouteComponentProps<{}, {}>, 'router' | 'route' | 'location'> & {
  projectSlug: Project['slug'];
  newOrg?: boolean;
  projectId?: Project['id'];
};

async function openChangeRouteModal({
  nextLocation,
  router,
}: {
  nextLocation: Location;
  router: RouteComponentProps<{}, {}>['router'];
}) {
  const mod = await import('sentry/components/onboarding/changeRouteModal');

  const {ChangeRouteModal} = mod;

  openModal(deps => (
    <ChangeRouteModal {...deps} router={router} nextLocation={nextLocation} />
  ));
}

export function FooterWithViewSampleErrorButton({
  projectSlug,
  projectId,
  router,
  newOrg,
}: Props) {
  const organization = useOrganization();
  const preferences = useLegacyStore(PreferencesStore);
  const [firstError, setFirstError] = useState<string | null>(null);
  const [firstIssue, setFirstIssue] = useState<Group | undefined>(undefined);
  const {projects} = useProjects();
  const onboardingContext = useContext(OnboardingContext);
  const projectData = projectId ? onboardingContext.data.projects[projectId] : undefined;
  const selectedProject = projects.find(project => project.slug === projectSlug);

  useApiQuery<Project>([`/projects/${organization.slug}/${projectSlug}/`], {
    staleTime: 0,
    refetchInterval: DEFAULT_POLL_INTERVAL,
    enabled:
      !!projectSlug &&
      !firstError &&
      projectData?.status === OnboardingProjectStatus.WAITING, // Fetch only if the project is available and we have not yet received an error,
    onSuccess: ([data]) => {
      setFirstError(data.firstEvent);
    },
  });

  // Locate the projects first issue group. The project.firstEvent field will
  // *not* include sample events, while just looking at the issues list will.
  // We will wait until the project.firstEvent is set and then locate the
  // event given that event datetime
  useApiQuery<Group[]>([`/projects/${organization.slug}/${projectSlug}/issues/`], {
    staleTime: 0,
    enabled:
      !!firstError &&
      !firstIssue &&
      projectData?.status === OnboardingProjectStatus.PROCESSING, // Only fetch if an error event is received and we have not yet located the first issue,
    onSuccess: ([data]) => {
      setFirstIssue(data.find((issue: Group) => issue.firstSeen === firstError));
    },
  });

  useEffect(() => {
    if (!projectId || !!projectData) {
      return;
    }

    onboardingContext.setData({
      ...onboardingContext.data,
      projects: {
        ...onboardingContext.data.projects,
        [projectId]: {
          slug: projectSlug,
          status: OnboardingProjectStatus.WAITING,
        },
      },
    });
  }, [projectData, onboardingContext, projectSlug, projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (!firstError) {
      return;
    }

    if (projectData?.status !== OnboardingProjectStatus.WAITING) {
      return;
    }

    trackAnalytics('onboarding.first_error_received', {
      organization,
      new_organization: !!newOrg,
      project_id: projectId,
      platform: selectedProject?.platform ?? 'other',
    });

    onboardingContext.setData({
      ...onboardingContext.data,
      projects: {
        ...onboardingContext.data.projects,
        [projectId]: {
          slug: projectSlug,
          status: OnboardingProjectStatus.PROCESSING,
        },
      },
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

    if (projectData?.status !== OnboardingProjectStatus.PROCESSING) {
      return;
    }

    trackAnalytics('onboarding.first_error_processed', {
      organization,
      new_organization: !!newOrg,
      project_id: projectId,
      platform: selectedProject?.platform ?? 'other',
    });

    onboardingContext.setData({
      ...onboardingContext.data,
      projects: {
        ...onboardingContext.data.projects,
        [projectId]: {
          slug: projectSlug,
          status: OnboardingProjectStatus.PROCESSED,
          firstIssueId: firstIssue.id,
        },
      },
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

  const handleSkipOnboarding = useCallback(() => {
    if (!projectId) {
      return;
    }

    if (
      onboardingContext.data.projects[projectId].status !==
      OnboardingProjectStatus.WAITING
    ) {
      return;
    }

    trackAnalytics('growth.onboarding_clicked_skip', {
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
    });
  }, [router, organization, onboardingContext, selectedProject, projectId]);

  const handleViewError = useCallback(() => {
    if (!projectId) {
      return;
    }

    trackAnalytics('onboarding.view_error_button_clicked', {
      organization,
      new_organization: !!newOrg,
      project_id: projectId,
      platform: selectedProject?.platform ?? 'other',
    });

    router.push({
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/${onboardingContext.data.projects[projectId].firstIssueId}/?referrer=onboarding-first-event-footer`,
    });
  }, [organization, newOrg, router, onboardingContext, projectId, selectedProject]);

  return (
    <Wrapper newOrg={!!newOrg} sidebarCollapsed={!!preferences.collapsed}>
      <Column>
        {projectData?.status === OnboardingProjectStatus.WAITING && newOrg && (
          <Button onClick={handleSkipOnboarding} priority="link">
            {t('Skip Onboarding')}
          </Button>
        )}
      </Column>
      <StatusesColumn>
        {projectData?.status === OnboardingProjectStatus.WAITING ? (
          <WaitingForErrorStatus>
            <IconCircle size="sm" />
            {t('Waiting for error')}
          </WaitingForErrorStatus>
        ) : projectData?.status === OnboardingProjectStatus.PROCESSED ? (
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
        {projectData?.status === OnboardingProjectStatus.PROCESSED ? (
          <Button priority="primary" onClick={handleViewError}>
            {t('View Error')}
          </Button>
        ) : (
          <CreateSampleEventButton
            project={selectedProject}
            source="targted-onboarding-heartbeat-footer"
            priority="primary"
            onCreateSampleGroup={() => {
              if (!projectId) {
                return;
              }

              trackAnalytics('onboarding.view_sample_error_button_clicked', {
                new_organization: !!newOrg,
                project_id: projectId,
                platform: selectedProject?.platform ?? 'other',
                organization,
              });
            }}
          >
            {t('View Sample Error')}
          </CreateSampleEventButton>
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
