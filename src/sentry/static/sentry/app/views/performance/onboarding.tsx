import styled from '@emotion/styled';

import OnboardingPanel from 'app/components/onboardingPanel';
import FeatureTourModal, {
  TourStep,
  TourText,
  TourImage,
} from 'app/components/modals/featureTourModal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Organization} from 'app/types';

import emptyStateImg from '../../../images/spot/performance-empty-state.svg';
import tourMetrics from '../../../images/spot/performance-tour-metrics.svg';
import tourCorrelate from '../../../images/spot/performance-tour-correlate.svg';
import tourTrace from '../../../images/spot/performance-tour-trace.svg';
import tourAlert from '../../../images/spot/performance-tour-alert.svg';

const performanceSetupUrl =
  'https://docs.sentry.io/performance-monitoring/getting-started/';

const docsLink = (
  <Button external href={performanceSetupUrl}>
    {t('Setup')}
  </Button>
);

const TOUR_STEPS: TourStep[] = [
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
};

function Onboarding({organization}: Props) {
  function handleAdvance(step: number, duration: number) {
    trackAnalyticsEvent({
      eventKey: 'performance_views.tour.advance',
      eventName: 'Performance Views: Tour Advance',
      organization_id: parseInt(organization.id, 10),
      step,
      duration,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAnalyticsEvent({
      eventKey: 'performance_views.tour.close',
      eventName: 'Performance Views: Tour Close',
      organization_id: parseInt(organization.id, 10),
      step,
      duration,
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
        <FeatureTourModal
          steps={TOUR_STEPS}
          onAdvance={handleAdvance}
          onCloseModal={handleClose}
          doneUrl={performanceSetupUrl}
          doneText={t('Start Setup')}
        >
          {({showModal}) => (
            <Button
              priority="default"
              onClick={() => {
                trackAnalyticsEvent({
                  eventKey: 'performance_views.tour.start',
                  eventName: 'Performance Views: Tour Start',
                  organization_id: parseInt(organization.id, 10),
                });
                showModal();
              }}
            >
              {t('Take a Tour')}
            </Button>
          )}
        </FeatureTourModal>
        <Button
          priority="primary"
          target="_blank"
          href="https://docs.sentry.io/performance-monitoring/getting-started/"
        >
          {t('Start Setup')}
        </Button>
      </ButtonList>
    </OnboardingPanel>
  );
}

const PerfImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    max-width: unset;
    user-select: none;
    position: absolute;
    top: 50px;
    bottom: 0;
    width: 450px;
    margin-top: auto;
    margin-bottom: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    width: 480px;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    width: 600px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default Onboarding;
