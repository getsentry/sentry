import PropTypes from 'prop-types';
import React from 'react';

import IntegrationDirectoryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow/integrationDirectoryApplicationRow';
import SentryTypes from 'app/sentryTypes';
import {Organization, SentryApp, SentryAppInstallation} from 'app/types';

type Props = {
  organization: Organization;
  install?: SentryAppInstallation;
  app: SentryApp;
};

class SentryAppInstallationDetail extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    install: PropTypes.object,
    app: PropTypes.object.isRequired,
  };

  render() {
    const {organization, install, app} = this.props;

    return (
      <React.Fragment>
        <IntegrationDirectoryApplicationRow
          app={app}
          organization={organization}
          install={install}
          isOnIntegrationPage
        />
      </React.Fragment>
    );
  }
}

export default SentryAppInstallationDetail;
