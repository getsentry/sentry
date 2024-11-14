import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureTourModal from 'sentry/components/modals/featureTourModal';
import {releaseHealth} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RELEASES_TOUR_STEPS} from 'sentry/views/releases/list/releasesPromo';

const DOCS_URL = 'https://docs.sentry.io/product/releases/';
const DOCS_HEALTH_URL = 'https://docs.sentry.io/product/releases/health/';

type Props = {
  organization: Organization;
  health?: boolean;
  platform?: PlatformKey;
  projectId?: string;
};

function MissingReleasesButtons({organization, health, projectId, platform}: Props) {
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

  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const setupDisabled =
    (health && platform && !releaseHealth.includes(platform)) || isSelfHostedErrorsOnly;
  const setupDisabledTooltip = isSelfHostedErrorsOnly
    ? t('Release health is not available for errors only self-hosted.')
    : t('Release Health is not yet supported on this platform.');

  return (
    <ButtonBar gap={1}>
      <LinkButton
        size="sm"
        priority="primary"
        external
        href={health ? DOCS_HEALTH_URL : DOCS_URL}
        disabled={setupDisabled}
        title={setupDisabled ? setupDisabledTooltip : undefined}
      >
        {t('Start Setup')}
      </LinkButton>
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
