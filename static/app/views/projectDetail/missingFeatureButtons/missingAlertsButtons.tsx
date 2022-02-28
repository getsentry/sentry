import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CreateAlertButton from 'sentry/components/createAlertButton';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';

const DOCS_URL = 'https://docs.sentry.io/product/alerts-notifications/metric-alerts/';

type Props = {
  organization: Organization;
  projectSlug: string;
};

function MissingAlertsButtons({organization, projectSlug}: Props) {
  return (
    <ButtonBar gap={1}>
      <CreateAlertButton
        organization={organization}
        iconProps={{size: 'xs'}}
        size="small"
        priority="primary"
        referrer="project_detail"
        projectSlug={projectSlug}
        hideIcon
      >
        {t('Create Alert')}
      </CreateAlertButton>
      <Button size="small" external href={DOCS_URL}>
        {t('Learn More')}
      </Button>
    </ButtonBar>
  );
}

export default MissingAlertsButtons;
