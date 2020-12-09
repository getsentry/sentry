import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import FeatureTourModal from 'app/components/modals/featureTourModal';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {PERFORMANCE_TOUR_STEPS} from 'app/views/performance/onboarding';

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
    <StyledButtonBar gap={1}>
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
            {t('Get a tour')}
          </Button>
        )}
      </FeatureTourModal>
    </StyledButtonBar>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: minmax(auto, max-content) minmax(auto, max-content);
`;

export default MissingPerformanceButtons;
