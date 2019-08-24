import React from 'react';

import SentryTypes from 'app/sentryTypes';
import {analytics} from 'app/utils/analytics';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import GroupDetails from './groupDetails';

class OrganizationGroupDetails extends React.Component {
  static propTypes = {
    selection: SentryTypes.GlobalSelection.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  componentDidMount() {
    analytics('issue_page.viewed', {
      group_id: parseInt(this.props.params.groupId, 10),
      org_id: parseInt(this.props.organization.id, 10),
    });
  }

  render() {
    const {selection, ...props} = this.props;

    return (
      <GroupDetails
        environments={selection.environments}
        enableSnuba
        showGlobalHeader
        {...props}
      />
    );
  }
}

export default withOrganization(withGlobalSelection(OrganizationGroupDetails));
