import React from 'react';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import MobileApp from './mobileApp';

class MobileAppContainer extends React.Component<MobileApp['props']> {
  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <Feature
        features={['mobile-app']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        <MobileApp {...this.props} />
      </Feature>
    );
  }
}

export default withOrganization(MobileAppContainer);
