import React from 'react';
import SentryTypes from 'app/sentryTypes';

import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import Feature from 'app/components/acl/feature';

import GroupDetails from '../shared/groupDetails';

class OrganizationGroupDetails extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    selection: SentryTypes.GlobalSelection.isRequired,
  };

  render() {
    // eslint-disable-next-line no-unused-vars
    const {selection, ...props} = this.props;

    return (
      <Feature features={['sentry10']} renderDisabled>
        <GlobalSelectionHeader organization={this.props.organization} />
        <PageContent>
          <GroupDetails environments={selection.environments} {...props} />
        </PageContent>
      </Feature>
    );
  }
}

export default withOrganization(withGlobalSelection(OrganizationGroupDetails));
