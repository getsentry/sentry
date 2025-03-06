import {navigateTo} from 'sentry/actionCreators/navigation';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureTourModal from 'sentry/components/modals/featureTourModal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {PERFORMANCE_TOUR_STEPS} from 'sentry/views/performance/onboarding';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';

const DOCS_URL = 'https://docs.sentry.io/performance-monitoring/getting-started/';

type Props = {
  organization: Organization;
};

function MissingPerformanceButtons({organization}: Props) {
  const router = useRouter();
  const {projects} = useProjects();
  const {
    selection: {projects: selectedProjects},
  } = usePageFilters();

  function handleTourAdvance(step: number, duration: number) {
    trackAnalytics('project_detail.performance_tour.advance', {
      organization,
      step,
      duration,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAnalytics('project_detail.performance_tour.close', {
      organization,
      step,
      duration,
    });
  }
  const hasPerfLandingRemovalFlag = organization.features?.includes(
    'insights-performance-landing-removal'
  );
  const domainView: DomainView | undefined = platformToDomainView(
    projects,
    selectedProjects
  );

  return (
    <Feature
      hookName="feature-disabled:project-performance-score-card"
      features="performance-view"
      organization={organization}
    >
      <ButtonBar gap={1}>
        <Button
          size="sm"
          priority="primary"
          onClick={event => {
            event.preventDefault();
            // TODO: add analytics here for this specific action.
            navigateTo(
              `${hasPerfLandingRemovalFlag ? getPerformanceBaseUrl(organization.slug) : getPerformanceBaseUrl(organization.slug, domainView)}/?project=:project#performance-sidequest`,
              router
            );
          }}
        >
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
            <Button size="sm" onClick={showModal}>
              {t('Get Tour')}
            </Button>
          )}
        </FeatureTourModal>
      </ButtonBar>
    </Feature>
  );
}

export default MissingPerformanceButtons;
