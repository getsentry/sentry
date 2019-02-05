import React from 'react';

import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
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
        <GroupDetails
          environments={selection.environments}
          enableSnuba={true}
          {...props}
        />
      </Feature>
    );
  }
}

export default withOrganization(withGlobalSelection(OrganizationGroupDetails));
