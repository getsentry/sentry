import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

type Props = React.PropsWithChildren<{
  organization: Organization;
}>;

function ProjectPerformanceScoreCard({organization}: Props) {
  return (
    <Button
      size="sm"
      priority="primary"
      onClick={() => openUpsellModal({organization, source: 'project-details'})}
    >
      {t('Learn More')}
    </Button>
  );
}

export default ProjectPerformanceScoreCard;
