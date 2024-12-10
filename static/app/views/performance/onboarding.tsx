import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/performance-empty-state.svg';
import tourAlert from 'sentry-images/spot/performance-tour-alert.svg';
import tourCorrelate from 'sentry-images/spot/performance-tour-correlate.svg';
import tourMetrics from 'sentry-images/spot/performance-tour-metrics.svg';
import tourTrace from 'sentry-images/spot/performance-tour-trace.svg';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import UnsupportedAlert from 'sentry/components/alerts/unsupportedAlert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {TourStep} from 'sentry/components/modals/featureTourModal';
import FeatureTourModal, {
  TourImage,
  TourText,
} from 'sentry/components/modals/featureTourModal';
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

const performanceSetupUrl =
  'https://docs.sentry.io/performance-monitoring/getting-started/';

const docsLink = (
  <LinkButton external href={performanceSetupUrl}>
    {t('Setup')}
  </LinkButton>
);

export const PERFORMANCE_TOUR_STEPS: TourStep[] = [
  {
    title: t('Track Application Metrics'),
    image: <TourImage src={tourMetrics} />,
    body: (
      <TourText>
        {t(
          'Monitor your slowest pageloads and APIs to see which users are having the worst time.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Correlate Errors and Traces'),
    image: <TourImage src={tourCorrelate} />,
    body: (
      <TourText>
        {t(
          'See what errors occurred within a transaction and the impact of those errors.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Watch and Alert'),
    image: <TourImage src={tourAlert} />,
    body: (
      <TourText>
        {t(
          'Highlight mission-critical pages and APIs and set latency alerts to notify you before things go wrong.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Trace Across Systems'),
    image: <TourImage src={tourTrace} />,
    body: (
      <TourText>
        {t(
          "Follow a trace from a user's session and drill down to identify any bottlenecks that occur."
        )}
      </TourText>
    ),
  },
];

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

  function handleAdvance(step: number, duration: number) {
    trackAnalytics('performance_views.tour.advance', {
      step,
      duration,
      organization,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAnalytics('performance_views.tour.close', {
      step,
      duration,
      organization,
    });
  }

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
        <FeatureTourModal
          steps={PERFORMANCE_TOUR_STEPS}
          onAdvance={handleAdvance}
          onCloseModal={handleClose}
          doneUrl={performanceSetupUrl}
          doneText={t('Start Setup')}
        >
          {({showModal}) => (
            <Button
              priority="link"
              onClick={() => {
                trackAnalytics('performance_views.tour.start', {organization});
                showModal();
              }}
            >
              {t('Take a Tour')}
            </Button>
          )}
        </FeatureTourModal>
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
