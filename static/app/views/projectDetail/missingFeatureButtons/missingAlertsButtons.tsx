import styled from '@emotion/styled';

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
    <StyledButtonBar gap={1}>
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
    </StyledButtonBar>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: minmax(auto, max-content) minmax(auto, max-content);
`;

export default MissingAlertsButtons;
