import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import FeatureTourModal from 'app/components/modals/featureTourModal';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {RELEASES_TOUR_STEPS} from 'app/views/releases/list/releasePromo';

const DOCS_URL = 'https://docs.sentry.io/product/releases/';
const DOCS_HEALTH_URL = 'https://docs.sentry.io/product/releases/health/';

type Props = {
  organization: Organization;
  health?: boolean;
  projectId?: string;
};

function MissingReleasesButtons({organization, health, projectId}: Props) {
  function handleTourAdvance(step: number, duration: number) {
    trackAnalyticsEvent({
      eventKey: 'project_detail.releases_tour.advance',
      eventName: 'Project Detail: Releases Tour Advance',
      organization_id: parseInt(organization.id, 10),
      project_id: projectId && parseInt(projectId, 10),
      step,
      duration,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAnalyticsEvent({
      eventKey: 'project_detail.releases_tour.close',
      eventName: 'Project Detail: Releases Tour Close',
      organization_id: parseInt(organization.id, 10),
      project_id: projectId && parseInt(projectId, 10),
      step,
      duration,
    });
  }

  return (
    <StyledButtonBar gap={1}>
      <Button
        size="small"
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
            <Button size="small" onClick={showModal}>
              {t('Get a tour')}
            </Button>
          )}
        </FeatureTourModal>
      )}
    </StyledButtonBar>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: minmax(auto, max-content) minmax(auto, max-content);
`;

export {StyledButtonBar};
export default MissingReleasesButtons;
