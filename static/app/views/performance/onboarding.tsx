import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/performance-empty-state.svg';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import UnsupportedAlert from 'sentry/components/alerts/unsupportedAlert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {filterProjects} from 'sentry/components/performanceOnboarding/utils';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  organization: Organization;
  project: Project;
};

function Onboarding({organization, project}: Props) {
  const api = useApi();
  const {projects} = useProjects();
  const location = useLocation();

  const {projectsForOnboarding} = filterProjects(projects);

  const showOnboardingChecklist = organization.features.includes(
    'performance-onboarding-checklist'
  );

  useEffect(() => {
    if (
      showOnboardingChecklist &&
      location.hash === '#performance-sidequest' &&
      projectsForOnboarding.some(p => p.id === project.id)
    ) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
    }
  }, [location.hash, projectsForOnboarding, project.id, showOnboardingChecklist]);

  const currentPlatform = project.platform;
  const hasPerformanceOnboarding = currentPlatform
    ? withPerformanceOnboarding.has(currentPlatform)
    : false;
  const noPerformanceSupport =
    currentPlatform && withoutPerformanceSupport.has(currentPlatform);

  let setupButton = (
    <LinkButton
      priority="primary"
      href="https://docs.sentry.io/performance-monitoring/getting-started/"
      external
    >
      {t('Start Setup')}
    </LinkButton>
  );

  if (hasPerformanceOnboarding && showOnboardingChecklist) {
    setupButton = (
      <Button
        priority="primary"
        onClick={event => {
          event.preventDefault();
          window.location.hash = 'performance-sidequest';
          SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
        }}
      >
        {t('Set Up Tracing')}
      </Button>
    );
  }

  return (
    <Fragment>
      {noPerformanceSupport && (
        <UnsupportedAlert projectSlug={project.slug} featureName="Performance" />
      )}
      <OnboardingPanel image={<PerfImage src={emptyStateImg} />}>
        <h3>{t('Pinpoint problems')}</h3>
        <p>
          {t(
            'Something seem slow? Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
          )}
        </p>
        <ButtonList gap={1}>
          {setupButton}
          <Button
            data-test-id="create-sample-transaction-btn"
            onClick={async () => {
              trackAnalytics('performance_views.create_sample_transaction', {
                platform: project.platform,
                organization,
              });
              addLoadingMessage(t('Processing sample event...'), {
                duration: 15000,
              });
              const url = `/projects/${organization.slug}/${project.slug}/create-sample-transaction/`;
              try {
                const eventData = await api.requestPromise(url, {method: 'POST'});
                const traceSlug = eventData.contexts?.trace?.trace_id ?? '';

                browserHistory.push(
                  generateLinkToEventInTraceView({
                    eventId: eventData.eventID,
                    location,
                    projectSlug: project.slug,
                    organization,
                    timestamp: eventData.endTimestamp,
                    traceSlug,
                    demo: `${project.slug}:${eventData.eventID}`,
                  })
                );
                clearIndicators();
              } catch (error) {
                Sentry.withScope(scope => {
                  scope.setExtra('error', error);
                  Sentry.captureException(new Error('Failed to create sample event'));
                });
                clearIndicators();
                addErrorMessage(t('Failed to create a new sample event'));
                return;
              }
            }}
          >
            {t('View Sample Transaction')}
          </Button>
        </ButtonList>
      </OnboardingPanel>
    </Fragment>
  );
}

const PerfImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: unset;
    user-select: none;
    position: absolute;
    top: 75px;
    bottom: 0;
    width: 450px;
    margin-top: auto;
    margin-bottom: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 480px;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 600px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  margin-bottom: 16px;
`;

export default Onboarding;
