import {withRouter} from 'react-router';
import React from 'react';

import {PageContent} from 'app/styles/organization';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class OrganizationStreamContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization, children} = this.props;

    return (
      <Feature features={['sentry10']} renderDisabled>
        <GlobalSelectionHeader organization={organization} />

        <PageContent>{children}</PageContent>
      </Feature>
    );
  }
}
export default withRouter(withOrganization(OrganizationStreamContainer));
export {OrganizationStreamContainer};
