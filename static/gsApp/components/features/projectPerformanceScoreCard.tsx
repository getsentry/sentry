import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

type Props = React.PropsWithChildren<{
  organization: Organization;
}>;

function ProjectPerformanceScoreCard({organization}: Props) {
  return (
    <Button
      size="sm" redesign
      priority="primary"
      onClick={() => openUpsellModal({organization, source: 'project-details'})}
    >
      {t('Learn More')}
    </Button>
  );
}

export default ProjectPerformanceScoreCard;
