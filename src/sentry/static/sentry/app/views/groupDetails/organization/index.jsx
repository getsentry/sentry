import React from 'react';

import SentryTypes from 'app/sentryTypes';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import GroupDetails from '../shared/groupDetails';

class OrganizationGroupDetails extends React.Component {
  static propTypes = {
    selection: SentryTypes.GlobalSelection.isRequired,
  };

  render() {
    // eslint-disable-next-line no-unused-vars
    const {selection, ...props} = this.props;

    return (
      <GroupDetails
        environments={selection.environments}
        enableSnuba={true}
        showGlobalHeader={true}
        {...props}
      />
    );
  }
}

export default withOrganization(withGlobalSelection(OrganizationGroupDetails));
