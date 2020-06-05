import React from 'react';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import {PageContent} from 'app/styles/organization';
import SentryTypes from 'app/sentryTypes';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
};

class PerformanceContainer extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    const {organization, children} = this.props;

    return (
      <Feature
        hookName="feature-disabled:performance-page"
        features={['performance-view']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        {children}
      </Feature>
    );
  }
}

export default withOrganization(PerformanceContainer);
