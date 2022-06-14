import {browserHistory} from 'react-router';
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
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureTourModal, {
  TourImage,
  TourStep,
  TourText,
} from 'sentry/components/modals/featureTourModal';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';

const performanceSetupUrl =
  'https://docs.sentry.io/performance-monitoring/getting-started/';

const docsLink = (
  <Button external href={performanceSetupUrl}>
    {t('Setup')}
  </Button>
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
    title: t('Correlate Errors and Performance'),
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

  function handleAdvance(step: number, duration: number) {
    trackAdvancedAnalyticsEvent('performance_views.tour.advance', {
      step,
      duration,
      organization,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAdvancedAnalyticsEvent('performance_views.tour.close', {
      step,
      duration,
      organization,
    });
  }

  return (
    <OnboardingPanel image={<PerfImage src={emptyStateImg} />}>
      <h3>{t('Pinpoint problems')}</h3>
      <p>
        {t(
          'Something seem slow? Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
        )}
      </p>
      <ButtonList gap={1}>
        <Button
          priority="primary"
          target="_blank"
          href="https://docs.sentry.io/performance-monitoring/getting-started/"
        >
          {t('Start Setup')}
        </Button>
        <Button
          data-test-id="create-sample-transaction-btn"
          onClick={async () => {
            trackAdvancedAnalyticsEvent('performance_views.create_sample_transaction', {
              platform: project.platform,
              organization,
            });
            addLoadingMessage(t('Processing sample event...'), {
              duration: 15000,
            });
            const url = `/projects/${organization.slug}/${project.slug}/create-sample-transaction/`;
            try {
              const eventData = await api.requestPromise(url, {method: 'POST'});
              browserHistory.push(
                `/organizations/${organization.slug}/performance/${project.slug}:${eventData.eventID}/`
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
              trackAdvancedAnalyticsEvent('performance_views.tour.start', {organization});
              showModal();
            }}
          >
            {t('Take a Tour')}
          </Button>
        )}
      </FeatureTourModal>
    </OnboardingPanel>
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
