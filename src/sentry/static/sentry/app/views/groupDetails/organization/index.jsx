import React from 'react';
import SentryTypes from 'app/sentryTypes';

import withOrganization from 'app/utils/withOrganization';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import Feature from 'app/components/acl/feature';

import GroupDetails from '../shared/groupDetails';

class OrganizationGroupDetails extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    return (
      <Feature features={['sentry10']} renderDisabled>
        <GlobalSelectionHeader organization={this.props.organization} />
        <PageContent>
          <GroupDetails {...this.props} />
        </PageContent>
      </Feature>
    );
  }
}

export default withOrganization(OrganizationGroupDetails);
