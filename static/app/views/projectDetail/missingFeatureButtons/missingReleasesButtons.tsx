import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureTourModal from 'sentry/components/modals/featureTourModal';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RELEASES_TOUR_STEPS} from 'sentry/views/releases/list/releasesPromo';

const DOCS_URL = 'https://docs.sentry.io/product/releases/';
const DOCS_HEALTH_URL = 'https://docs.sentry.io/product/releases/health/';

type Props = {
  organization: Organization;
  health?: boolean;
  projectId?: string;
};

function MissingReleasesButtons({organization, health, projectId}: Props) {
  function handleTourAdvance(step: number, duration: number) {
    trackAnalytics('project_detail.releases_tour.advance', {
      organization,
      project_id: projectId ?? '',
      step,
      duration,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAnalytics('project_detail.releases_tour.close', {
      organization,
      project_id: projectId ?? '',
      step,
      duration,
    });
  }

  return (
    <ButtonBar gap={1}>
      <Button
        size="sm"
        priority="primary"
        external
        href={health ? DOCS_HEALTH_URL : DOCS_URL}
      >
        {t('Start Setup')}
      </Button>
      {!health && (
        <FeatureTourModal
          steps={RELEASES_TOUR_STEPS}
          onAdvance={handleTourAdvance}
          onCloseModal={handleClose}
          doneText={t('Start Setup')}
          doneUrl={health ? DOCS_HEALTH_URL : DOCS_URL}
        >
          {({showModal}) => (
            <Button size="sm" onClick={showModal}>
              {t('Get Tour')}
            </Button>
          )}
        </FeatureTourModal>
      )}
    </ButtonBar>
  );
}

export default MissingReleasesButtons;
