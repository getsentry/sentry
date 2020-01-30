import React from 'react';

import IntegrationDirectoryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow/integrationDirectoryApplicationRow';
import {Organization, SentryApp, SentryAppInstallation} from 'app/types';

type Props = {
  organization: Organization;
  install?: SentryAppInstallation;
  app: SentryApp;
};

const SentryAppInstallationDetail = (props: Props) => {
  return (
    <React.Fragment>
      <IntegrationDirectoryApplicationRow {...props} isOnIntegrationPage />
    </React.Fragment>
  );
};

export default SentryAppInstallationDetail;
