import {LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import CreateAlertButton from 'sentry/components/createAlertButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

const DOCS_URL = 'https://docs.sentry.io/product/alerts-notifications/metric-alerts/';

type Props = {
  organization: Organization;
  projectSlug: string;
};

function MissingAlertsButtons({organization, projectSlug}: Props) {
  return (
    <Grid flow="column" align="center" gap="md">
      <CreateAlertButton
        organization={organization}
        iconProps={{size: 'xs'}}
        size="sm"
        priority="primary"
        referrer="project_detail"
        projectSlug={projectSlug}
        hideIcon
      >
        {t('Create Alert')}
      </CreateAlertButton>
      <LinkButton size="sm" external href={DOCS_URL}>
        {t('Learn More')}
      </LinkButton>
    </Grid>
  );
}

export default MissingAlertsButtons;
