import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import CreateAlertButton from 'app/components/createAlertButton';
import {t} from 'app/locale';
import {Organization} from 'app/types';

const DOCS_URL = 'https://docs.sentry.io/workflow/alerts-notifications/alerts/';

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
