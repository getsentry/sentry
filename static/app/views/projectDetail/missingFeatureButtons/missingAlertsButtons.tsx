import {LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {CreateAlertButton} from 'sentry/components/createAlertButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

const DOCS_URL = 'https://docs.sentry.io/product/alerts-notifications/metric-alerts/';

type Props = {
  organization: Organization;
  projectSlug: string;
};

export function MissingAlertsButtons({organization, projectSlug}: Props) {
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
        analyticsEventKey="project_detail.alerts_create_alert_clicked"
        analyticsEventName="Project Detail: Alerts Create Alert Clicked"
      >
        {t('Create Alert')}
      </CreateAlertButton>
      <LinkButton
        size="sm"
        external
        href={DOCS_URL}
        analyticsEventKey="project_detail.alerts_learn_more_clicked"
        analyticsEventName="Project Detail: Alerts Learn More Clicked"
      >
        {t('Learn More')}
      </LinkButton>
    </Grid>
  );
}
