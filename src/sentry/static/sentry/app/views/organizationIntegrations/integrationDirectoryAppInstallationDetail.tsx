import React from 'react';

import IntegrationDirectoryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow/integrationDirectoryApplicationRow';

const SentryAppInstallationDetail = (
  props: Omit<IntegrationDirectoryApplicationRow['props'], 'isOnIntegrationPage'>
) => {
  return (
    <React.Fragment>
      <IntegrationDirectoryApplicationRow {...props} isOnIntegrationPage />
    </React.Fragment>
  );
};

export default SentryAppInstallationDetail;
