import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureTourModal from 'sentry/components/modals/featureTourModal';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {PERFORMANCE_TOUR_STEPS} from 'sentry/views/performance/onboarding';

const DOCS_URL = 'https://docs.sentry.io/performance-monitoring/getting-started/';

type Props = {
  organization: Organization;
};

function MissingPerformanceButtons({organization}: Props) {
  function handleTourAdvance(step: number, duration: number) {
    trackAnalyticsEvent({
      eventKey: 'project_detail.performance_tour.advance',
      eventName: 'Project Detail: Performance Tour Advance',
      organization_id: parseInt(organization.id, 10),
      step,
      duration,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAnalyticsEvent({
      eventKey: 'project_detail.performance_tour.close',
      eventName: 'Project Detail: Performance Tour Close',
      organization_id: parseInt(organization.id, 10),
      step,
      duration,
    });
  }

  return (
    <Feature
      hookName="feature-disabled:project-performance-score-card"
      features={['performance-view']}
      organization={organization}
    >
      <ButtonBar gap={1}>
        <Button size="small" priority="primary" external href={DOCS_URL}>
          {t('Start Setup')}
        </Button>

        <FeatureTourModal
          steps={PERFORMANCE_TOUR_STEPS}
          onAdvance={handleTourAdvance}
          onCloseModal={handleClose}
          doneText={t('Start Setup')}
          doneUrl={DOCS_URL}
        >
          {({showModal}) => (
            <Button size="small" onClick={showModal}>
              {t('Get Tour')}
            </Button>
          )}
        </FeatureTourModal>
      </ButtonBar>
    </Feature>
  );
}

export default MissingPerformanceButtons;
