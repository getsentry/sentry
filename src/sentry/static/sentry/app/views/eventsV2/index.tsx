import React from 'react';

import ComingSoon from 'app/components/acl/comingSoon';
import Feature from 'app/components/acl/feature';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
};

class DiscoverContainer extends React.Component<Props> {
  renderNoAccess() {
    return (
      <PageContent>
        <ComingSoon />
      </PageContent>
    );
  }

  render() {
    const {organization, children} = this.props;

    return (
      <Feature
        features={['discover-basic']}
        organization={organization}
        hookName="feature-disabled:discover2-page"
        renderDisabled={this.renderNoAccess}
      >
        {children}
      </Feature>
    );
  }
}

export default withOrganization(DiscoverContainer);
